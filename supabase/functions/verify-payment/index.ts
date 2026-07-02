import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import Stripe from "npm:stripe@15.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
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

    // Initialize Supabase Client with User Token
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

    const { sessionId, billId, paymentMode } = await req.json();
    if (!sessionId || !billId) {
      return new Response(JSON.stringify({ error: "Session ID and Bill ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Admin Client
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if payment was already processed
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("transaction_id", sessionId)
      .maybeSingle();

    if (existingPayment && existingPayment.status === "success") {
      return new Response(JSON.stringify({
        message: "Payment already processed",
        payment: existingPayment
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch bill details
    const { data: bill, error: billError } = await supabaseAdmin
      .from("bills")
      .select(`
        id,
        amount,
        penalty,
        billing_month,
        due_date,
        flat:flats(
          id,
          wing,
          flat_number,
          flat_type,
          area_sqft,
          maintenance_amount,
          society:societies(name, address),
          owner:profiles(name, email, phone)
        )
      `)
      .eq("id", billId)
      .single();

    if (billError || !bill) {
      return new Response(JSON.stringify({ error: "Associated bill not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMock = sessionId.startsWith("mock_session_");
    let transactionVerified = false;
    let finalTxId = sessionId;
    const totalAmount = Number(bill.amount) + Number(bill.penalty);

    if (isMock) {
      transactionVerified = true;
    } else {
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ error: "Stripe configuration missing on server" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
          transactionVerified = true;
          finalTxId = session.payment_intent as string || session.id;
        }
      } catch (stripeErr: any) {
        return new Response(JSON.stringify({ error: `Stripe verification failed: ${stripeErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!transactionVerified) {
      return new Response(JSON.stringify({ error: "Transaction has not been settled yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update Bill Status
    const { error: billUpdateError } = await supabaseAdmin
      .from("bills")
      .update({ status: "paid" })
      .eq("id", billId);

    if (billUpdateError) {
      throw new Error(`Failed to update bill status: ${billUpdateError.message}`);
    }

    // Generate Payment Record placeholder
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        bill_id: billId,
        flat_id: bill.flat.id,
        amount: totalAmount,
        payment_mode: paymentMode || "card",
        transaction_id: finalTxId,
        status: "success",
      })
      .select()
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to log payment record: ${paymentError?.message}`);
    }

    // --- RECEIPT PDF GENERATION (pdf-lib) ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Page size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const primaryColor = rgb(30/255, 41/255, 59/255); // Slate 800
    const secondaryColor = rgb(2/255, 132/255, 199/255); // Sky 600
    const textColor = rgb(51/255, 65/255, 85/255); // Slate 700
    const lightText = rgb(100/255, 116/255, 139/255); // Slate 500

    const societyName = bill.flat?.society?.name || "SOCIETY MAINTENANCE MANAGER";
    const societyAddress = bill.flat?.society?.address || "";
    const flatOwnerName = bill.flat?.owner?.name || "Resident";
    const flatOwnerEmail = bill.flat?.owner?.email || user.email || "";
    const flatOwnerPhone = bill.flat?.owner?.phone || "—";
    const wingUnit = `Wing ${bill.flat?.wing} - Unit ${bill.flat?.flat_number} (${bill.flat?.flat_type})`;

    // Top Header Banner
    page.drawRectangle({
      x: 0,
      y: 841.89 - 15,
      width: 595.28,
      height: 15,
      color: secondaryColor,
    });

    // Society Title
    page.drawText(societyName.toUpperCase(), {
      x: 50,
      y: 770,
      size: 20,
      font: boldFont,
      color: primaryColor,
    });

    // Address
    page.drawText(societyAddress, {
      x: 50,
      y: 745,
      size: 9,
      font: font,
      color: lightText,
      maxWidth: 320,
      lineHeight: 12,
    });

    // Receipt Badge Box
    page.drawRectangle({
      x: 400,
      y: 725,
      width: 145,
      height: 65,
      color: rgb(248/255, 250/255, 252/255),
      borderColor: rgb(226/255, 232/255, 240/255),
      borderWidth: 1,
    });

    page.drawText("MAINTENANCE", {
      x: 412,
      y: 768,
      size: 11,
      font: boldFont,
      color: primaryColor,
    });
    page.drawText("RECEIPT", {
      x: 412,
      y: 752,
      size: 11,
      font: boldFont,
      color: primaryColor,
    });
    page.drawText(`No: ${finalTxId.substring(0, 12).toUpperCase()}`, {
      x: 412,
      y: 737,
      size: 7.5,
      font: font,
      color: lightText,
    });

    // Horizontal Rule
    page.drawLine({
      start: { x: 50, y: 700 },
      end: { x: 545, y: 700 },
      color: rgb(226/255, 232/255, 240/255),
      thickness: 1,
    });

    // Two Column Metadata layout
    // Col 1: Issued To
    page.drawText("Issued To:", { x: 50, y: 670, size: 10, font: boldFont, color: primaryColor });
    page.drawText(flatOwnerName, { x: 50, y: 652, size: 10, font: font, color: textColor });
    page.drawText(`Flat: ${wingUnit}`, { x: 50, y: 637, size: 9, font: font, color: lightText });
    page.drawText(`Email: ${flatOwnerEmail}`, { x: 50, y: 622, size: 9, font: font, color: lightText });
    page.drawText(`Phone: ${flatOwnerPhone}`, { x: 50, y: 607, size: 9, font: font, color: lightText });

    // Col 2: Transaction Details
    page.drawText("Transaction Details:", { x: 350, y: 670, size: 10, font: boldFont, color: primaryColor });
    page.drawText(`Billing Month: ${bill.billing_month}`, { x: 350, y: 652, size: 10, font: font, color: textColor });
    page.drawText(`Payment Date: ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`, { x: 350, y: 637, size: 9, font: font, color: lightText });
    page.drawText(`Payment Mode: ${(paymentMode || "card").toUpperCase()}`, { x: 350, y: 622, size: 9, font: font, color: lightText });
    page.drawText(`Tx ID: ${finalTxId}`, { x: 350, y: 607, size: 9, font: font, color: lightText });

    // Table Header Box
    page.drawRectangle({
      x: 50,
      y: 540,
      width: 495,
      height: 25,
      color: primaryColor,
    });

    page.drawText("Description", { x: 60, y: 548, size: 9, font: boldFont, color: rgb(1,1,1) });
    page.drawText("Billing Cycle", { x: 260, y: 548, size: 9, font: boldFont, color: rgb(1,1,1) });
    page.drawText("Late Penalty", { x: 370, y: 548, size: 9, font: boldFont, color: rgb(1,1,1) });
    page.drawText("Amount (INR)", { x: 470, y: 548, size: 9, font: boldFont, color: rgb(1,1,1) });

    // Table Row Box
    page.drawRectangle({
      x: 50,
      y: 495,
      width: 495,
      height: 45,
      color: rgb(248/255, 250/255, 252/255),
      borderColor: rgb(226/255, 232/255, 240/255),
      borderWidth: 1,
    });

    page.drawText("Society Maintenance Charges", { x: 60, y: 512, size: 9, font: font, color: textColor });
    page.drawText(bill.billing_month, { x: 260, y: 512, size: 9, font: font, color: textColor });
    page.drawText(`Rs. ${Number(bill.penalty).toFixed(2)}`, { x: 370, y: 512, size: 9, font: font, color: textColor });
    page.drawText(`Rs. ${Number(bill.amount).toFixed(2)}`, { x: 470, y: 512, size: 9, font: font, color: textColor });

    // Total section
    page.drawText("Total Paid:", { x: 370, y: 460, size: 10, font: boldFont, color: primaryColor });
    page.drawText(`Rs. ${totalAmount.toFixed(2)}`, {
      x: 470,
      y: 458,
      size: 13,
      font: boldFont,
      color: secondaryColor,
    });

    // Info footer note
    page.drawText("* Generated electronically. No signature required.", {
      x: 50,
      y: 400,
      size: 8,
      font: font,
      color: lightText,
    });

    page.drawLine({
      start: { x: 50, y: 100 },
      end: { x: 545, y: 100 },
      color: rgb(226/255, 232/255, 240/255),
      thickness: 1,
    });

    page.drawText("Thank you for your prompt maintenance payment. It helps keep our society clean, secure, and beautiful!", {
      x: 50,
      y: 75,
      size: 8.5,
      font: font,
      color: lightText,
      maxWidth: 495,
    });

    const pdfBytes = await pdfDoc.save();

    // Upload PDF to Supabase Storage
    const receiptPath = `Receipt_${payment.id}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(receiptPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(`Storage Upload Error: ${uploadError.message}`);
    } else {
      // Update Payment Record with Receipt URL
      await supabaseAdmin
        .from("payments")
        .update({ receipt_url: `receipts/${receiptPath}` })
        .eq("id", payment.id);
    }

    // --- TRIGGER EMAIL RECEIPTS (Resend) ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
        const fromEmail = Deno.env.get("SMTP_FROM") || "receipts@societymanager.local";

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0284c7; margin-bottom: 5px;">Payment Received Successfully!</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">Receipt Reference: ${finalTxId}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            
            <p>Dear <strong>${flatOwnerName}</strong>,</p>
            <p>Thank you for making your maintenance payment. We have successfully processed your transaction. Here is a summary of your receipt:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Resident Name</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">${flatOwnerName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Flat Number</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">${bill.flat.wing} - ${bill.flat.flat_number}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Billing Cycle</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">${bill.billing_month}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Payment Method</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(paymentMode || "card").toUpperCase()}</td>
              </tr>
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 12px 15px; font-weight: bold; color: #0f172a; font-size: 16px;">Total Paid</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold; color: #0284c7; font-size: 16px;">Rs. ${totalAmount.toFixed(2)}</td>
              </tr>
            </table>

            <p>We have attached the official PDF receipt to this email for your records.</p>
            
            <div style="margin-top: 30px; padding: 15px; background-color: #f0f9ff; border-radius: 6px; border-left: 4px solid #0284c7;">
              <p style="margin: 0; font-size: 13px; color: #0369a1;"><strong>Note:</strong> This is a system-generated email. Please do not reply directly to this message. For any queries regarding billing, contact the society office.</p>
            </div>

            <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">Society Maintenance Manager App &copy; 2026</p>
          </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: flatOwnerEmail,
            subject: `Maintenance Payment Receipt - ${bill.billing_month} - Flat ${bill.flat.wing}-${bill.flat.flat_number}`,
            html: emailHtml,
            attachments: [
              {
                filename: `Receipt_${finalTxId.substring(0, 8)}.pdf`,
                content: base64Pdf,
              }
            ]
          }),
        });

        const resData = await res.json();
        console.log(`Resend API Dispatch Successful: ${JSON.stringify(resData)}`);
      } catch (emailErr: any) {
        console.error(`Resend Email dispatch failure: ${emailErr.message}`);
      }
    } else {
      console.log(`[MOCK EMAIL] Send receipt to ${flatOwnerEmail}. Amount: Rs. ${totalAmount.toFixed(2)}.`);
    }

    return new Response(JSON.stringify({
      message: "Payment settled and receipt dispatched",
      payment: {
        ...payment,
        receipt_url: `receipts/${receiptPath}`
      }
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
