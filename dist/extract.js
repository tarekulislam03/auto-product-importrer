"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromImage = extractTextFromImage;
exports.parseBillText = parseBillText;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai = new openai_1.default({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/Start-Prescription/pharmacy-pos-saas",
        "X-Title": "Pharmacy POS Text Extractor",
    }
});
// Extract text from image - Enhanced prompt for pharmacy bills
async function extractTextFromImage(imageUrl) {
    console.log(`[OCR] Processing image with model: google/gemma-3-27b-it:free`);
    let fullText = "";
    try {
        const stream = await openai.chat.completions.create({
            model: "google/gemma-3-27b-it:free",
            messages: [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": `You are an OCR assistant for Indian pharmacy invoices/bills.
Extract ALL text from this invoice image COMPLETELY and ACCURATELY.

Pay special attention to:
- Invoice Number, Date, Supplier/Distributor Name at the top
- The TABLE of products with columns like: Product Name, Batch No, Expiry Date, Qty, MRP, Rate, Amount
- Each row in the table represents one medicine/product
- Numbers, dates, and batch codes must be extracted exactly as shown

Output the text in a structured format preserving the table layout.
Extract EVERY row from the product table - do not skip any items.`
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": imageUrl
                            }
                        }
                    ]
                }
            ],
            stream: true
        });
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                process.stdout.write(content);
                fullText += content;
            }
        }
        console.log(`\n[OCR] Extracted ${fullText.length} characters`);
        return fullText;
    }
    catch (error) {
        console.error("[OCR] Error extracting text:", error);
        throw error;
    }
}
// Parse bill text to JSON - Enhanced prompt with exact field mapping
async function parseBillText(text) {
    console.log("[Parser] Parsing bill text with model: upstage/solar-pro-3:free...");
    try {
        const response = await openai.chat.completions.create({
            model: 'arcee-ai/trinity-large-preview:free', // Better at structured extraction
            messages: [
                {
                    role: 'system',
                    content: `You are an AI that extracts structured data from Indian pharmacy purchase bill text.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no explanations, no extra text.

Extract the following structure:
{
    "invoiceNumber": "invoice/bill number from header",
    "invoiceDate": "date from header (keep original format)",
    "supplierName": "distributor/supplier company name from header",
    "totalAmount": numeric_total_amount,
    "items": [
        {
            "medicine_name": "product/medicine name",
            "batch_number": "batch/lot number",
            "expiry_date": "expiry date (keep original format like MM/YY)",
            "quantity": numeric_quantity,
            "mrp": numeric_mrp_price,
            "rate": numeric_purchase_rate_or_cost_price
        }
    ]
}

RULES:
1. Extract EVERY product row from the table - do not skip any items
2. Use exact field names as shown above (medicine_name, batch_number, expiry_date, quantity, mrp, rate)
3. For numbers, extract only the numeric value (no currency symbols)
4. If a field is not found, use empty string "" for text or 0 for numbers
5. Rate = Cost Price = Purchase Rate (the price pharmacy pays)
6. MRP = Maximum Retail Price (printed price for customers)
7. Quantity = number of units/packs purchased`
                },
                {
                    role: 'user',
                    content: `Extract ALL products from this pharmacy bill. Do not skip any items:\n\n${text}`
                }
            ],
        });
        const content = response.choices[0].message.content;
        console.log("[Parser] Raw response length:", content?.length || 0);
        // Robust JSON extraction
        let jsonStr = content || '{}';
        // If content contains markdown code blocks, strip them
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }
        else {
            // Fallback: find { and }
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
        }
        const parsed = JSON.parse(jsonStr);
        // Validate and normalize items
        if (parsed.items && Array.isArray(parsed.items)) {
            parsed.items = parsed.items.map((item) => ({
                medicine_name: String(item.medicine_name || item.productName || item.name || ''),
                batch_number: String(item.batch_number || item.batchNumber || ''),
                expiry_date: String(item.expiry_date || item.expiryDate || ''),
                quantity: Number(item.quantity) || 0,
                mrp: Number(item.mrp || item.MRP) || 0,
                rate: Number(item.rate || item.cost_price || item.costPrice || item.purchaseRate) || 0
            }));
        }
        console.log(`[Parser] Extracted ${parsed.items?.length || 0} items`);
        return parsed;
    }
    catch (error) {
        console.error("[Parser] Error parsing bill text:", error);
        return { error: "Failed to parse JSON", details: String(error), items: [] };
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Usage: npx ts-node extract.ts <image_url>");
    }
    else {
        const text = await extractTextFromImage(args[0]);
        console.log("\n--- Parsed JSON ---");
        const json = await parseBillText(text);
        console.log(JSON.stringify(json, null, 2));
    }
}
if (require.main === module) {
    main().catch(console.error);
}
