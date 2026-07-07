import { QuizProvider, useQuiz } from "./context/QuizContext";
import { CartProvider, useCart } from "./context/CartContext"; 
import CartDrawer from "./components/ui/CartDrawer"; 
import ProgressBar from "./components/ProgressBar";
import Home from "./components/Home"; 
import Section1AboutMe from "./components/sections/Section1AboutMe";
import Section2Male from "./components/sections/Section2Male";
import Section2Female from "./components/sections/Section2Female";
import Section3Male from "./components/sections/Section3Male";
import Section3Female from "./components/sections/Section3Female";
import Section4Scalp from "./components/sections/Section4Scalp";
import Result from "./components/Result";
import Section0Consent from "./components/sections/Section0Consent";
import "./styles/index.css";

function QuizFlow() {
  const { state, nextStep, prevStep, goToStep } = useQuiz();
  const { setIsCartOpen, cartCount } = useCart(); 
  const { step, aboutMe, isLoading } = state;

  const isMale = aboutMe?.gender === "male";

  let content;

  if (isLoading && step === 5) {
    content = (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xs text-center border border-gray-100 max-w-md mx-auto my-12 animate-[fadeIn_0.2s_ease-out]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#064e3b] border-gray-100 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Processing Scalp Metrics</h3>
        <p className="text-xs text-gray-400 mt-2">Our computer vision system is calculating density variations and mapping root coverage fields...</p>
      </div>
    );
  } else {
    switch (step) {
      case 0:
        content = <Home onStart={() => goToStep(0.5)} />;
        break;
      case 0.5:
        content = <Section0Consent onComplete={() => goToStep(1)} onBack={() => goToStep(0)} />;
        break;
      case 1:
        content = <Section1AboutMe onComplete={nextStep} onBack={() => goToStep(0.5)} />;
        break;
      case 2:
        if (aboutMe?.gender === "female") {
          content = <Section2Female onComplete={nextStep} onBack={prevStep} />;
        } else {
          content = <Section2Male onComplete={nextStep} onBack={prevStep} />;
        }
        break;
      case 3:
        content = isMale ? 
          <Section3Male onComplete={nextStep} onBack={prevStep} /> : 
          <Section3Female onComplete={nextStep} onBack={prevStep} />;
        break;
      case 4:
        content = <Section4Scalp onComplete={nextStep} onBack={prevStep} />;
        break;
      case 5:
        content = <Result />;
        break;
      default:
        content = <Home onStart={() => goToStep(0.5)} />;
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f0] text-gray-900 px-4 md:px-8 pb-16 antialiased">
      <header className="max-w-6xl mx-auto flex items-center justify-between py-5 border-b border-gray-200/60 mb-8">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
          onClick={() => window.location.reload()}
        >
          <div className="w-8 h-8 rounded-full bg-[#064e3b] flex items-center justify-center text-white text-xs font-serif shadow-sm">✦</div>
          <span className="text-xl font-bold tracking-tight text-[#064e3b] font-serif">Zylk Health</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative bg-white border border-gray-200 shadow-sm h-10 px-4 rounded-full font-bold text-xs text-gray-700 hover:bg-gray-50 transition-all cursor-pointer flex items-center gap-1.5 select-none"
          >
            <span>🛒 Cart</span>
            {cartCount > 0 && (
              <span className="bg-[#064e3b] text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center animate-[scaleIn_0.2s_ease-out]">
                {cartCount}
              </span>
            )}
          </button>

          <button 
            type="button"
            onClick={() => {
              if (step === 0) goToStep(0.5);
              else window.location.reload();
            }} 
            className="text-sm font-semibold text-gray-700 hover:text-[#064e3b] transition-colors hidden sm:inline-block cursor-pointer"
          >
            {step === 0 ? "Start Assessment →" : "Restart Quiz ↺"}
          </button>
        </div>
      </header>

      {step >= 1 && step <= 4 && (
        <div className="max-w-xl mx-auto mb-8">
          <ProgressBar step={step} />
        </div>
      )}

      <main className={`mx-auto flex justify-center items-start ${step === 0 ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="w-full">{content}</div>
      </main>
    </div>
  );
}

// 🟢 Global Context Wrapper Matrix Setup with standard export default statement
export default function App() {
  return (
    <CartProvider>
      <QuizProvider>
        <QuizFlow />
        <CartDrawer /> 
      </QuizProvider>
    </CartProvider>
  );
}