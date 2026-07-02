import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import Stripe from "npm:stripe@15.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Initialize Supabase Client with User's JWT to authenticate them
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { billId, paymentMode } = await req.json();
    if (!billId) {
      return new Response(JSON.stringify({ error: "Bill ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch bill details bypassing RLS via Admin Client
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: bill, error: billError } = await supabaseAdmin
      .from("bills")
      .select(`
        id,
        amount,
        penalty,
        billing_month,
        status,
        flat:flats(
          id,
          wing,
          flat_number,
          society:societies(name)
        )
      `)
      .eq("id", billId)
      .single();

    if (billError || !bill) {
      return new Response(JSON.stringify({ error: "Bill not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bill.status === "paid") {
      return new Response(JSON.stringify({ error: "This bill has already been settled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = Number(bill.amount) + Number(bill.penalty);
    const mockPayments = Deno.env.get("MOCK_PAYMENTS") === "true";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (mockPayments || !stripeSecretKey || stripeSecretKey.startsWith("sk_test_mock")) {
      // Mock checkout flow
      const mockSessionId = `mock_session_${Date.now()}`;
      const mockUrl = `http://localhost:5173/payment/mock-checkout?session_id=${mockSessionId}&bill_id=${bill.id}&amount=${totalAmount}`;
      
      return new Response(JSON.stringify({
        sessionId: mockSessionId,
        url: mockUrl,
        isMock: true
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real Stripe payment flow
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const societyName = bill.flat?.society?.name || "Society Manager";
    const wing = bill.flat?.wing || "";
    const flatNo = bill.flat?.flat_number || "";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `Maintenance Bill - ${bill.billing_month}`,
              description: `Wing ${wing}, Flat ${flatNo} - ${societyName}`,
            },
            unit_amount: Math.round(totalAmount * 100), // Stripe expects amounts in cents/paise
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}&bill_id=${bill.id}`,
      cancel_url: `http://localhost:5173/payment/cancel?bill_id=${bill.id}`,
      metadata: {
        billId: bill.id,
        flatId: bill.flat?.id,
        ownerId: user.id
      }
    });

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
      isMock: false
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
