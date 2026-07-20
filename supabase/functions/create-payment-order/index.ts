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
    const body = await req.json();
    let billIds = body.billIds || (body.billId ? [body.billId] : []);
    const advanceMonths = body.advanceMonths || [];
    const paymentMode = body.paymentMode || 'card';

    // Fetch bill details bypassing RLS via Admin Client
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (advanceMonths.length > 0) {
      // Find the flat owned by this user
      const { data: flat, error: flatErr } = await supabaseAdmin
        .from("flats")
        .select("id, maintenance_amount")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (flatErr || !flat) {
        return new Response(JSON.stringify({ error: "No flat found owned by this resident for advance billing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const month of advanceMonths) {
        const { data: existingBill } = await supabaseAdmin
          .from("bills")
          .select("id, status")
          .eq("flat_id", flat.id)
          .eq("billing_month", month)
          .maybeSingle();

        if (existingBill) {
          if (existingBill.status !== 'paid' && !billIds.includes(existingBill.id)) {
            billIds.push(existingBill.id);
          }
        } else {
          // Insert new bill
          const { data: newBill, error: insertErr } = await supabaseAdmin
            .from("bills")
            .insert({
              flat_id: flat.id,
              billing_month: month,
              amount: flat.maintenance_amount,
              penalty: 0,
              due_date: `${month}-10`,
              status: 'pending'
            })
            .select()
            .single();

          if (!insertErr && newBill) {
            billIds.push(newBill.id);
          }
        }
      }
    }

    if (billIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bill ID(s) or advance months required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bills, error: billError } = await supabaseAdmin
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
      .in("id", billIds);

    if (billError || !bills || bills.length === 0) {
      return new Response(JSON.stringify({ error: "Associated bills not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anyPaid = bills.some(b => b.status === "paid");
    if (anyPaid) {
      return new Response(JSON.stringify({ error: "One or more bills have already been settled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = bills.reduce((sum, b) => sum + Number(b.amount) + Number(b.penalty), 0);
    const mockPayments = Deno.env.get("MOCK_PAYMENTS") === "true";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    const billIdsStr = bills.map(b => b.id).join(",");

    if (mockPayments || !stripeSecretKey || stripeSecretKey.startsWith("sk_test_mock")) {
      // Mock checkout flow
      const mockSessionId = `mock_session_${Date.now()}`;
      const mockUrl = `http://localhost:5173/payment/mock-checkout?session_id=${mockSessionId}&bill_ids=${billIdsStr}&amount=${totalAmount}`;
      
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

    const firstBill = bills[0];
    const societyName = firstBill.flat?.society?.name || "Society Manager";
    const wing = firstBill.flat?.wing || "";
    const flatNo = firstBill.flat?.flat_number || "";

    const lineItems = bills.map(b => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: `Maintenance Bill - ${b.billing_month}`,
          description: `Wing ${b.flat?.wing || ""}, Flat ${b.flat?.flat_number || ""} - ${societyName}`,
        },
        unit_amount: Math.round((Number(b.amount) + Number(b.penalty)) * 100),
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}&bill_ids=${billIdsStr}`,
      cancel_url: `http://localhost:5173/payment/cancel?bill_ids=${billIdsStr}`,
      metadata: {
        billIds: billIdsStr,
        flatId: firstBill.flat?.id,
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
