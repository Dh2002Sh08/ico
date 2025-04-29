// import CreateToken from "@/components/CreateToken";

import ICO from "@/components/ico";
import IcoStatus from "@/components/icoStatus";
import WhiteList from "@/components/whiteList";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <ICO />
        <WhiteList />
        <IcoStatus />

      </div>
    </main>
  );
}
