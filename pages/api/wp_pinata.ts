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

// Function to create whitepaper metadata and upload to Pinata
export const createWhitepaperMetadata = async (
  projectName: string,
  motive: string,
  aim: string,
  supply: string,
  links: string,
  description: string,
  whitepaperFile: File
) => {
  try {
    // Upload the whitepaper file to Pinata and get its URL (CID)
    const whitepaperCid = await uploadToPinata(whitepaperFile);

    // Define whitepaper metadata JSON
    const metadata = {
      project_name: projectName,
      description: description,
      motive: motive,
      aim: aim,
      supply: supply,
      links: links,
      whitepaper_cid: whitepaperCid,
      // You can include other relevant metadata fields here (e.g., version, timestamp)
      version: 1, // This can be dynamically managed based on previous submissions
    };

    // Convert metadata JSON to a Blob
    const metadataJson = JSON.stringify(metadata);
    const metadataBlob = new Blob([metadataJson], { type: 'application/json' });

    // Convert Blob to File for upload
    const metadataFile = new File([metadataBlob], 'whitepaper-metadata.json', { type: 'application/json' });

    // Upload metadata JSON file to Pinata
    const metadataIpfsHash = await uploadToPinata(metadataFile);

    return metadataIpfsHash; // Returns the metadata IPFS URL
  } catch (error) {
    console.error('Error creating and uploading whitepaper metadata:', error);
    throw new Error('Failed to create and upload whitepaper metadata');
  }
};

// Function to upload whitepaper metadata (optional)
export const uploadWhitepaperMetadata = async (
  projectName: string,
  motive: string,
  aim: string,
  supply: string,
  links: string,
  description: string,
  whitepaperFile: File
) => {
  return await createWhitepaperMetadata(projectName,motive, aim, supply, links, description, whitepaperFile);
};
