import axios from 'axios';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_KEY as string;
const PINATA_API_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY as string;
const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// Helper function to upload a file to Pinata
export const uploadToPinata = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(PINATA_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // ✅ FIXED: Removed `.getBoundary()`
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_API_SECRET,
      },
    });

    const ipfsHash = response.data.IpfsHash;
    return `https://coffee-peculiar-thrush-870.mypinata.cloud/ipfs/${ipfsHash}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw new Error('Failed to upload to Pinata');
  }
};

// Function to create token metadata and upload to Pinata
export const createTokenMetadata = async (name: string, symbol: string, imageFile: File) => {
  try {
    // Upload the image to Pinata and get its URL
    const imageUrl = await uploadToPinata(imageFile);

    // Define metadata JSON
    const metadata = {
      name,
      symbol,
      description: `${name} token, symbol: ${symbol}`,
      image: imageUrl,
      attributes: [],
    };

    // Convert metadata JSON to a Blob
    const metadataJson = JSON.stringify(metadata);
    const metadataBlob = new Blob([metadataJson], { type: 'application/json' });

    // Convert Blob to File for upload
    const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });

    // Upload metadata JSON file to Pinata
    const metadataIpfsHash = await uploadToPinata(metadataFile);

    return metadataIpfsHash;
  } catch (error) {
    console.error('Error creating and uploading metadata:', error);
    throw new Error('Failed to create and upload metadata');
  }
};

// Function to upload metadata (optional)
export const uploadMetaData = async (name: string, symbol: string, imageFile: File) => {
  return await createTokenMetadata(name, symbol, imageFile);
};
