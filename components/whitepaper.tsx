"use client";
import { useMemo, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { uploadWhitepaperMetadata } from '../pages/api/wp_pinata';
import {
  fetchAllMetaAccountsByUser,
  submitWhitepaper,
} from '../utils/wp_useprogram';
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@project-serum/anchor";
import { toast } from "react-toastify";


interface WhitepaperMeta {
  projectName: string;
  versionCount: number;
  latestCid: string;
  lastUpdated: BN ; // Keep as `any` if it's a BN or custom type; can cast in render
  publicKey: {
    toBase58: () => string;
  };
}

export default function WhitepaperForm() {
  const [projectName, setProjectName] = useState("");
  const [motive, setMotive] = useState("");
  const [aim, setAim] = useState("");
  const [supply, setSupply] = useState("");
  const [links, setLinks] = useState("");
  const [whitepaper, setWhitepaper] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [transactionLink, setTransactionLink] = useState<string | null>(null);
  const [allMetaAccounts, setAllMetaAccounts] = useState<WhitepaperMeta[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, wallet } = useWallet();

  const provider = useMemo(() => {
    if (!wallet || !publicKey || !signTransaction || !signAllTransactions) return null;

    return new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'processed' }
    );
  }, [wallet, publicKey, signTransaction, signAllTransactions, connection]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTransactionLink(null);

    if (image && whitepaper && provider) {
      try {
        const whitepaperCid = await uploadWhitepaperMetadata(
          projectName,
          motive,
          aim,
          supply,
          links,
          whitepaper,
          image
        );

        const tx = await submitWhitepaper({
          provider,
          author: provider.wallet.publicKey,
          cid: whitepaperCid,
          projectName,
        });

        const txLink = `https://solana.fm/tx/${tx}?cluster=devnet`;
        setTransactionLink(txLink);
        toast.success("Transaction successful: " + tx);
        const allMetaAccounts = await fetchAllMetaAccountsByUser(provider, provider.wallet.publicKey);
        setAllMetaAccounts(allMetaAccounts);

        toast.success("Whitepaper Data Fetched Successfully");

      } catch (error) {
        toast.error("Error submitting whitepaper: " + error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      console.error("Whitepaper, image file, or provider is missing");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-2xl rounded-2xl mt-10">
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">📄 Submit Your Project Whitepaper</h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label className="block text-sm font-medium mb-1">Project Name</label>
          <input
            className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project Motive</label>
          <textarea
            className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project Aim</label>
          <textarea
            className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={aim}
            onChange={(e) => setAim(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Total Token Supply</label>
          <input
            type="number"
            className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Related Links (GitHub, Website, etc.)</label>
          <input
            type="text"
            className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Separate multiple links with commas"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Whitepaper Content (Markdown Supported)</label>
          <textarea
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            value={whitepaper}
            onChange={(e) => setWhitepaper(e.target.value)}
            rows={6}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project Logo / Banner</label>
          <input
            type="file"
            accept="image/*"
            className="w-full rounded-xl border p-2 cursor-pointer"
            onChange={handleImageUpload}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-lg rounded-xl transition
            ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} /> Submitting...
            </>
          ) : (
            <>
              <Upload size={20} /> Submit Whitepaper
            </>
          )}
        </button>
      </form>

      {transactionLink && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Transaction Link:</p>
          <a
            href={transactionLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {transactionLink}
          </a>
        </div>
      )}

      {allMetaAccounts.length > 0 && (

        <div className="mt-10">

          <h3 className="text-2xl font-semibold mb-4 text-gray-800">📚 All Submitted Whitepapers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300 rounded-xl">
              <thead>
                <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-600">
                  <th className="py-3 px-4 border-b">Project Name</th>
                  <th className="py-3 px-4 border-b">Version Count</th>
                  <th className="py-3 px-4 border-b">Latest CID</th>
                  <th className="py-3 px-4 border-b">Last Updated</th>
                  <th className="py-3 px-4 border-b">Account Address</th>
                </tr>
              </thead>
              <tbody>
                {allMetaAccounts.map((meta, index) => (

                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 px-4 border-b">{meta.projectName}</td>
                    <td className="py-3 px-4 border-b">{meta.versionCount.toString()}</td>
                    <td className="py-3 px-4 border-b">{meta.latestCid}</td>
                    <td className="py-3 px-4 border-b">
                      {(() => {
                        const timestamp =
                          typeof meta.lastUpdated?.toNumber === "function"
                            ? meta.lastUpdated.toNumber() * 1000
                            : Date.parse(meta.lastUpdated); // handles ISO string

                        return isNaN(timestamp)
                          ? "N/A"
                          : new Date(timestamp).toLocaleString();
                      })()}
                    </td>
                    <td className="py-3 px-4 border-b font-mono text-xs text-blue-600">
                      {meta.publicKey.toBase58()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
