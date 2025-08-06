import CryptoJS from 'crypto-js';

export async function encryptFile(file: File): Promise<string> {
  try {
    // Check file size (limit to 10MB to ensure safe storage)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to WordArray for CryptoJS
    const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
    
    // Generate a random key and IV
    const key = CryptoJS.lib.WordArray.random(32);
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt the file content
    const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine the key, IV, and encrypted data
    const combined = {
      k: key.toString(), // key
      i: iv.toString(), // iv
      d: encrypted.toString(), // data
      s: wordArray.sigBytes // original size
    };
    
    // Convert to JSON and then to base64 with URL-safe characters
    const jsonString = JSON.stringify(combined);
    const base64 = btoa(unescape(encodeURIComponent(jsonString)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    return base64;
  } catch (error: any) {
    console.error('Encryption error:', error);
    throw new Error(
      error.message === 'File size exceeds 10MB limit'
        ? error.message
        : 'Failed to encrypt file. Please try again with a smaller file.'
    );
  }
}

export async function decryptFile(base64Data: string, fileName: string, mimeType: string): Promise<void> {
  try {
    // Input validation
    if (!base64Data) {
      throw new Error('No data provided for decryption');
    }

    // Restore base64 padding
    let standardBase64 = base64Data
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if necessary
    while (standardBase64.length % 4) {
      standardBase64 += '=';
    }
    
    // Decode base64 to get the JSON string
    let jsonStr: string;
    try {
      const decodedData = atob(standardBase64);
      jsonStr = decodeURIComponent(escape(decodedData));
    } catch (error) {
      console.error('Base64 decoding error:', error);
      throw new Error('Invalid file data format');
    }
    
    // Parse JSON
    let decryptionData: { k: string; i: string; d: string; s: number };
    try {
      decryptionData = JSON.parse(jsonStr);
    } catch (error) {
      console.error('JSON parsing error:', error);
      throw new Error('Invalid file data structure');
    }
    
    // Validate required fields
    if (!decryptionData.k || !decryptionData.i || !decryptionData.d || !decryptionData.s) {
      throw new Error('Incomplete file data');
    }
    
    // Convert key and IV from hex strings to WordArrays
    const key = CryptoJS.enc.Hex.parse(decryptionData.k);
    const iv = CryptoJS.enc.Hex.parse(decryptionData.i);
    
    // Decrypt the data
    const decrypted = CryptoJS.AES.decrypt(
      decryptionData.d,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    // Convert to Uint8Array
    const words = decrypted.words;
    const sigBytes = decryptionData.s;
    const u8 = new Uint8Array(sigBytes);
    
    let offset = 0;
    for (let i = 0; i < words.length && offset < sigBytes; i++) {
      const word = words[i];
      for (let j = 0; j < 4 && offset < sigBytes; j++) {
        u8[offset] = (word >>> (24 - j * 8)) & 0xff;
        offset++;
      }
    }
    
    // Create and download the file
    const blob = new Blob([u8], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'downloaded-file';
    
    // Use click() on a hidden anchor element
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error: any) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
}