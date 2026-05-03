import { useEffect } from "react";
import splashBg from "../../assets/splash.png";
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
      <img className="splash-bg" src={splashBg} alt="" />
      <img className="splash-logo" src={Logo} alt="Nujin Desktop" />
    </div>
  );
}

export default SplashScreen;
