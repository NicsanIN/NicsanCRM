import { AuthProvider } from './contexts/AuthContext';
import NicsanCRM from "./NicsanCRM";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-zinc-50">
        <NicsanCRM />
      </div>
    </AuthProvider>
  );
}
