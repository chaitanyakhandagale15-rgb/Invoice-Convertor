import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  const baseUrl = 'http://localhost:3000/api';
  console.log('--- Starting API Tests ---');

  // 1. Create a dummy PDF file
  const dummyPdfPath = path.join(process.cwd(), 'dummy.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  
  // Test 1: Upload
  console.log('\n1. Testing POST /api/upload');
  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync(dummyPdfPath)], { type: 'application/pdf' });
  formData.append('file', fileBlob, 'dummy.pdf');
  
  const uploadRes = await fetch(`${baseUrl}/upload`, { method: 'POST', body: formData });
  const uploadData = await uploadRes.json();
  console.log('Upload Response:', uploadData);
  if (!uploadData.invoiceId) throw new Error('Upload failed');
  const invoiceId = uploadData.invoiceId;

  // Test 2: Extract
  console.log('\n2. Testing POST /api/extract');
  const extractRes = await fetch(`${baseUrl}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId,
      extractedData: {
        invoiceNumber: "INV-TEST-001",
        invoiceDate: "Jan 01, 2026",
        seller: { name: "Test Seller", address: "123 US St" },
        buyer: { name: "Test Buyer", address: "456 IN St" },
        lineItems: [
          { sno: 1, description: "Consulting", hsnCode: "9954", quantity: 1, unitPrice: 1000, amount: 1000 }
        ],
        subtotal: 1000,
        taxAmount: 0,
        taxRate: 0,
        total: 1000,
        currency: "USD"
      }
    })
  });
  const extractData = await extractRes.json();
  console.log('Extract Response:', extractData);
  if (!extractData.success) throw new Error('Extract failed');

  // Test 3: Convert
  console.log('\n3. Testing POST /api/convert');
  const convertRes = await fetch(`${baseUrl}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId,
      extractedData: extractData.extractedData,
      conversionOptions: {
        exchangeRate: 83,
        gstRate: 18,
        supplyType: "inter-state",
        sellerGSTIN: "27AAAAA0000A1Z5",
        buyerGSTIN: "29BBBBB0000B2Z6",
        placeOfSupply: "Karnataka",
        stateCode: "29"
      }
    })
  });
  const convertData = await convertRes.json();
  console.log('Convert Response:', convertData);
  if (!convertData.convertedInvoiceId) throw new Error('Convert failed');
  const convertedInvoiceId = convertData.convertedInvoiceId;

  // Test 4: Download
  console.log(`\n4. Testing GET /api/download/${convertedInvoiceId}`);
  const downloadRes = await fetch(`${baseUrl}/download/${convertedInvoiceId}`);
  console.log('Download Status:', downloadRes.status, downloadRes.headers.get('content-type'));
  if (downloadRes.status !== 200) throw new Error('Download failed');

  // Test 5: List Invoices
  console.log('\n5. Testing GET /api/invoices');
  const listRes = await fetch(`${baseUrl}/invoices?page=1&limit=5`);
  const listData = await listRes.json();
  console.log('List Invoices Response: Stats =', listData.stats);
  if (!listData.invoices) throw new Error('List invoices failed');

  console.log('\n✅ All API Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
