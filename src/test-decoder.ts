import { getDbPool } from './config/database'

const base64ToBytes = (str: string): Uint8Array => {
    let cleanStr = str;
    const commaIdx = cleanStr.indexOf(",");
    if (commaIdx !== -1) {
        cleanStr = cleanStr.slice(commaIdx + 1);
    }

    // Decode URL-encoded base64 characters directly
    cleanStr = cleanStr.replace(/%2B/gi, "+").replace(/%2F/gi, "/").replace(/%3D/gi, "=");

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    // Support URL-safe base64 characters by mapping them
    const normalized: string[] = [];
    for (let i = 0; i < cleanStr.length; i++) {
        const char = cleanStr[i];
        if (char === "-") normalized.push("+");
        else if (char === "_") normalized.push("/");
        else if (alphabet.indexOf(char) !== -1) {
            normalized.push(char);
        }
    }
    const clean = normalized.join("");
    
    // Build lookup table
    const lookup = new Uint8Array(256);
    for (let i = 0; i < alphabet.length; i++) {
        lookup[alphabet.charCodeAt(i)] = i;
    }
    
    const len = clean.length;
    const numBytes = Math.floor((len * 3) / 4);
    const bytes = new Uint8Array(numBytes);
    
    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const c1 = lookup[clean.charCodeAt(i)] || 0;
        const c2 = lookup[clean.charCodeAt(i + 1)] || 0;
        const c3 = lookup[clean.charCodeAt(i + 2)] || 0;
        const c4 = lookup[clean.charCodeAt(i + 3)] || 0;
        
        if (p < numBytes) bytes[p++] = (c1 << 2) | (c2 >> 4);
        if (p < numBytes) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2);
        if (p < numBytes) bytes[p++] = ((c3 & 3) << 6) | c4;
    }
    
    return bytes;
};

async function test() {
  const pool = await getDbPool()
  const result = await pool.request().query('SELECT Base64Data FROM Asset3D WHERE AssetId = 1')
  const raw = result.recordset[0].Base64Data
  
  const commaIdx = raw.indexOf(',')
  const b64 = commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw
  
  const expectedBytes = Buffer.from(b64, 'base64')
  const gotBytes = base64ToBytes(raw)
  
  console.log('Expected Length:', expectedBytes.length)
  console.log('Got Length:', gotBytes.length)
  
  let diffCount = 0
  for (let i = 0; i < Math.max(expectedBytes.length, gotBytes.length); i++) {
    if (expectedBytes[i] !== gotBytes[i]) {
      if (diffCount < 10) {
        console.log(`Diff at index ${i}: Expected ${expectedBytes[i]}, Got ${gotBytes[i]}`)
      }
      diffCount++
    }
  }
  console.log('Total differences:', diffCount)
  process.exit(0)
}

test()
