import React, { useEffect } from "react";
import Logo from "../../assets/logo.png";

interface SplashScreenProps {
  onFinished: () => void;
}

function SplashScreen({ onFinished }: SplashScreenProps): React.JSX.Element {
  useEffect(() => {
    onFinished();
  }, [onFinished]);

  return (
    <div className="splash-screen">
      {/* Background Accents */}
      <div className="pointer-events-none fixed inset-0 opacity-40 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[40rem] h-[40rem] rounded-full blur-3xl splash-accent-1 splash-animate-gradient"></div>
        <div className="absolute -bottom-24 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl splash-accent-2 splash-animate-gradient"></div>
      </div>

      <img className="splash-logo" src={Logo} alt="Nujin Desktop" />
    </div>
  );
}

export default SplashScreen;
