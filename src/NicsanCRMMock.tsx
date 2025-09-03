import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, Table2, Settings, LayoutDashboard, Users, BarChart3, BadgeInfo, Filter, Lock, LogOut, Car, SlidersHorizontal, TrendingUp } from "lucide-react";
import { ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, Area, AreaChart, XAxis, YAxis, Tooltip } from "recharts";
import { uploadAPI, policiesAPI, authAPI, authUtils } from './services/api';
import { extractAPI } from './api/extract';
import ErrorBoundary from './components/ErrorBoundary';

// MetaLine component to display extraction metadata
function MetaLine({ meta }: { meta?: { via?: string; modelTag?: string; pdfTextChars?: number; text_ms?: number; llm_ms?: number; total_ms?: number } }) {
  if (!meta) return null;
  const via = meta.via?.toUpperCase();
  const model = meta.modelTag === 'secondary' ? 'gpt-4.1-mini' : 'gpt-4o-mini';
  return (
    <div className="mt-1 text-xs text-gray-500">
      {via} • {model} • {meta.pdfTextChars ?? 0} chars • {meta.text_ms ?? 0}ms text + {meta.llm_ms ?? 0}ms LLM = {meta.total_ms ?? 0}ms
    </div>
  );
}

// --- Nicsan CRM v1 UI/UX Mock (updated) ---
// Adds: Password-protected login, optimized Manual Form, Founder filters, KPI dashboard (your new metrics)
// Now: Manual Form includes ALL requested columns; PDF flow includes a small manual entry panel.
// Tailwind CSS assumed. Static demo state only.

// ---------- AUTH ----------
function LoginPage({ onLogin }: { onLogin: (user: { name: string; email: string; role: "ops" | "founder" }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ops"|"founder">("ops");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Use real authentication API
      const response = await authAPI.login({ email, password });
      

      
      if (response.success && response.data) {
        const { token, user: userData } = response.data;
        

        
        if (!token) {
          setError('No token received from server');
          return;
        }
        
        // Store token and user data
        try {
          authUtils.setToken(token);
        } catch (error) {
          console.error('Token storage failed:', error);
        }
        
        try {
          localStorage.setItem('authToken', token);
        } catch (error) {
          console.error('LocalStorage storage failed:', error);
        }
        
        // Call onLogin with real user data
        const userInfo = { 
          name: userData?.name || email.split('@')[0] || 'User', 
          email: userData?.email || email, 
          role: userData?.role || 'ops' 
        };
        onLogin(userInfo);
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-zinc-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 text-lg font-semibold mb-1"><Lock className="w-5 h-5"/> Nicsan CRM v1</div>
        <div className="text-sm text-zinc-500 mb-6">Real authentication with backend API</div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <label className="block mb-3">
          <div className="text-xs text-zinc-600 mb-1">Email</div>
          <input 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" 
            placeholder="ops@nicsan.in"
            disabled={isLoading}
          />
        </label>
        <label className="block mb-4">
          <div className="text-xs text-zinc-600 mb-1">Password</div>
          <input 
            type="password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" 
            placeholder="••••••••"
            disabled={isLoading}
          />
        </label>
        
        <button 
          onClick={handleLogin} 
          disabled={isLoading}
          className="w-full px-4 py-2 rounded-xl bg-zinc-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
        
        <div className="text-xs text-zinc-500 mt-3 text-center">
          Test credentials: ops@nicsan.in / ops123
        </div>
        <div className="text-xs text-zinc-500 mt-2 text-center">
          Founder: admin@nicsan.in / admin123
        </div>
      </div>
    </div>
  )
}

// ---------- LAYOUT ----------
function TopTabs({ tab, setTab, user, onLogout }: { tab: "ops" | "founder"; setTab: (t: "ops" | "founder") => void; user: {name:string; role:"ops"|"founder"}; onLogout: ()=>void }) {
  const founderDisabled = user.role !== 'founder';
  return (
    <div className="w-full border-b border-zinc-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-xl font-semibold">Nicsan CRM v1</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-xl bg-zinc-100 p-1 flex gap-2">
            <button onClick={() => setTab("ops")} className={`px-4 py-2 rounded-lg text-sm ${tab === "ops" ? "bg-white shadow" : "text-zinc-600"}`}>Operations</button>
            <button onClick={() => !founderDisabled && setTab("founder")} className={`px-4 py-2 rounded-lg text-sm ${tab === "founder" ? "bg-white shadow" : founderDisabled?"text-zinc-300 cursor-not-allowed":"text-zinc-600"}`}>Founder</button>
          </div>
          <div className="text-sm text-zinc-600 px-2 py-1 rounded-lg bg-zinc-100">{user.name} · {user.role.toUpperCase()}</div>
          <button onClick={onLogout} className="px-3 py-2 rounded-lg border flex items-center gap-2"><LogOut className="w-4 h-4"/> Logout</button>
        </div>
      </div>
    </div>
  )
}

function Shell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 lg:col-span-3 space-y-3">{sidebar}</aside>
      <main className="col-span-12 lg:col-span-9 space-y-6">{children}</main>
    </div>
  )
}

function Card({ title, desc, children, actions }: { title: string; desc?: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="font-semibold text-zinc-900">{title}</div>
        {desc && (
          <div className="text-xs text-zinc-500 flex items-center gap-1"><BadgeInfo className="w-4 h-4"/>{desc}</div>
        )}
        <div className="ml-auto">{actions}</div>
      </div>
      {children}
    </div>
  )
}

function Tile({ label, value, sub, info }: { label: string; value: string; sub?: string; info?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
      <div className="text-xs text-zinc-500 flex items-center gap-1">{label} {info && <span className="text-[10px] text-zinc-400">({info})</span>}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-emerald-600 mt-1">{sub}</div>}
    </div>
  )
}

// ---------- OPS ----------
function OpsSidebar({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  const items = [
    { id: "upload", label: "PDF Upload", icon: Upload },
    { id: "review", label: "Review & Confirm", icon: FileText },
    { id: "manual-form", label: "Manual Form", icon: CheckCircle2 },
    { id: "manual-grid", label: "Grid Entry", icon: Table2 },
    { id: "policy-detail", label: "Policy Detail", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ]
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-2 sticky top-20">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setPage(id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${page===id?"bg-zinc-900 text-white":"hover:bg-zinc-100"}`}>
          <Icon className="w-4 h-4"/> {label}
        </button>
      ))}
      <div className="px-3 pt-2 text-[11px] text-zinc-500">
        Tip: <kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> move · <kbd>Ctrl+S</kbd> save · <kbd>Ctrl+Enter</kbd> save & next
      </div>
    </div>
  )
}

function PageUpload() {
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<'TATA_AIG' | 'DIGIT'>('TATA_AIG');
  const [manualExtras, setManualExtras] = useState({
    executive: '',
    callerName: '',
    mobile: '',
    rollover: '',
    remark: '',
    brokerage: '',
    cashback: '',
    customerPaid: '',
    customerChequeNo: '',
    ourChequeNo: ''
  });
  const [manualExtrasSaved, setManualExtrasSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (!files?.length || uploading) return; // prevent duplicates
    setUploading(true);
    
    const file = files[0];
    if (!file) {
      setUploading(false);
      return;
    }
    
    if (!selectedInsurer) {
      setToast({type: 'error', message: 'Please select an insurer first'});
      setTimeout(() => setToast(null), 3000);
      setUploading(false);
      return;
    }

    if (!manualExtrasSaved) {
      setToast({type: 'error', message: '⚠️ Please save your manual extras first before uploading PDF'});
      setTimeout(() => setToast(null), 3000);
      setUploading(false);
      return;
    }

    setUploadStatus('Uploading...');

    try {
      // Upload PDF with insurer
      const result = await uploadAPI.uploadPDF(file, selectedInsurer);
      
      if (result.ok) {
          setUploadStatus('Upload successful! Ready for review.');
        setToast({type: 'success', message: 'Upload successful!'});
          // Auto-dismiss toast after 3 seconds
          setTimeout(() => setToast(null), 3000);
          
        // Use the upload result data directly
        const uploadData = result.data;
        if (uploadData) {
        const newFile = {
            id: uploadData.id,
            filename: uploadData.filename,
            status: uploadData.upload_status || 'UPLOADED',
            insurer: selectedInsurer,
            s3_key: uploadData.s3_key,
            time: new Date().toLocaleTimeString(),
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            // Structure that matches Review page expectations
            extracted_data: {
              insurer: selectedInsurer,
              status: 'UPLOADED',
              manual_extras: { ...manualExtras },
              extracted_data: {
                // Mock PDF data for demo (in real app, this comes from your extractor)
                policy_number: "TA-" + Math.floor(Math.random() * 10000),
                vehicle_number: "KA01AB" + Math.floor(Math.random() * 1000),
                insurer: selectedInsurer === 'TATA_AIG' ? 'Tata AIG' : 'Digit',
                product_type: "Private Car",
                vehicle_type: "Private Car",
                make: "Maruti",
                model: "Swift",
                cc: "1197",
                manufacturing_year: "2021",
                issue_date: new Date().toISOString().split('T')[0],
                expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                idv: 495000,
                ncb: 20,
                discount: 0,
                net_od: 5400,
                ref: "",
                total_od: 7200,
                net_premium: 10800,
                total_premium: 12150,
                confidence_score: 0.86
              }
            }
          };
          
          setUploadedFiles(prev => [newFile, ...prev]);
          
          // Save to localStorage so Review page can access it
          const allUploads = [newFile, ...uploadedFiles];
          localStorage.setItem('nicsan_crm_uploads', JSON.stringify(allUploads));

          // Set the newly uploaded file as the selected one for the Review page
          localStorage.setItem('nicsan_crm_selected_upload_id', newFile.id);
          
          // Start polling for status updates
          pollUploadStatus(uploadData.id);
        }
        
        // Clear manual extras after successful upload
        setManualExtras({
          executive: '',
          callerName: '',
          mobile: '',
          rollover: '',
          remark: '',
          brokerage: '',
          cashback: '',
          customerPaid: '',
          customerChequeNo: '',
          ourChequeNo: ''
        });
        setManualExtrasSaved(false);
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
        setToast({type: 'error', message: `Upload failed: ${result.error}`});
        setTimeout(() => setToast(null), 5000);
      }
    } catch (err: any) {
      console.error('uploadPDF failed', { status: err?.status, data: err?.data, err });
      const errorMessage = `Upload failed: ${err?.status ?? ''} ${err?.data?.error ?? err?.message ?? 'unknown'}`;
      setUploadStatus(errorMessage);
      setToast({type: 'error', message: errorMessage});
      setTimeout(() => setToast(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const pollUploadStatus = async (uploadId: string) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;
    
    const poll = async () => {
      try {
        const response = await uploadAPI.getUploadById(uploadId);
        
        if (response.success && response.data) {
          const status = response.data.upload_status;
          
          // Update local state
          setUploadedFiles(prev => {
            const updated = prev.map(f => 
              f.id === uploadId ? { 
                ...f, 
                status,
                extracted_data: {
                  ...f.extracted_data,
                  status
                }
              } : f
            );
            
            // Update localStorage with new status
            localStorage.setItem('nicsan_crm_uploads', JSON.stringify(updated));

            
            return updated;
          });
          
          if (status === 'review' || status === 'completed') {
            setUploadStatus('PDF processed successfully! Ready for review.');
            
            // Show notification for review
            if (status === 'review') {
              // In a real app, you might want to show a toast notification
              console.log('🎉 PDF ready for review! Check the Review & Confirm page.');
              
              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('PDF Ready for Review!', {
                  body: 'Your PDF has been processed and is ready for review.',
                  icon: '📄'
                });
              }
              
              // Show alert for demo purposes
              alert('🎉 PDF processed successfully! Ready for review. Go to Review & Confirm page.');
            }
            
            return; // Stop polling
          } else if (status === 'failed') {
            setUploadStatus('PDF processing failed. Please try again.');
            return; // Stop polling
          }
          
          // Continue polling if still processing
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 2000); // Poll every 2 seconds
          } else {
            setUploadStatus('PDF processing timed out. Please check status.');
          }
        }
      } catch (error) {
        console.error('Status polling failed:', error);
      }
    };
    
    // Start polling
    poll();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleManualExtrasChange = (field: string, value: string) => {
    setManualExtras(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Card title="Drag & Drop PDF" desc="(S3 = cloud folder). Tata AIG & Digit only in v1.">
        {/* Insurer Selection */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Select Insurer</div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input 
                type="radio" 
                value="TATA_AIG" 
                checked={selectedInsurer === 'TATA_AIG'}
                onChange={(e) => setSelectedInsurer(e.target.value as 'TATA_AIG' | 'DIGIT')}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm">Tata AIG</span>
            </label>
            <label className="flex items-center gap-2">
              <input 
                type="radio" 
                value="DIGIT" 
                checked={selectedInsurer === 'DIGIT'}
                onChange={(e) => setSelectedInsurer(e.target.value as 'TATA_AIG' | 'DIGIT')}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm">Digit</span>
            </label>
          </div>
        </div>

        {/* Manual Extras Section */}
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="text-sm font-medium mb-3 text-blue-800">📝 Manual Extras (from Sales Rep)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-blue-700 mb-1">Executive</label>
              <input 
                type="text" 
                placeholder="Sales rep name"
                value={manualExtras.executive}
                onChange={(e) => handleManualExtrasChange('executive', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Caller Name</label>
              <input 
                type="text" 
                placeholder="Telecaller name"
                value={manualExtras.callerName}
                onChange={(e) => handleManualExtrasChange('callerName', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Mobile Number</label>
              <input 
                type="text" 
                placeholder="9xxxxxxxxx"
                value={manualExtras.mobile}
                onChange={(e) => handleManualExtrasChange('mobile', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Rollover/Renewal</label>
              <input 
                type="text" 
                placeholder="Internal code"
                value={manualExtras.rollover}
                onChange={(e) => handleManualExtrasChange('rollover', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Brokerage (₹)</label>
              <input 
                type="number" 
                placeholder="Commission amount"
                value={manualExtras.brokerage}
                onChange={(e) => handleManualExtrasChange('brokerage', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Cashback (₹)</label>
              <input 
                type="number" 
                placeholder="Total cashback"
                value={manualExtras.cashback}
                onChange={(e) => handleManualExtrasChange('cashback', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Customer Paid (₹)</label>
              <input 
                type="number" 
                placeholder="Amount customer paid"
                value={manualExtras.customerPaid}
                onChange={(e) => handleManualExtrasChange('customerPaid', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Customer Cheque No</label>
              <input 
                type="text" 
                placeholder="Customer's cheque number"
                value={manualExtras.customerChequeNo}
                onChange={(e) => handleManualExtrasChange('customerChequeNo', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Our Cheque No</label>
              <input 
                type="text" 
                placeholder="Your company's cheque number"
                value={manualExtras.ourChequeNo}
                onChange={(e) => handleManualExtrasChange('ourChequeNo', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-blue-700 mb-1">Remark</label>
              <textarea 
                placeholder="Any additional notes or special instructions"
                value={manualExtras.remark}
                onChange={(e) => handleManualExtrasChange('remark', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={2}
              />
            </div>
          </div>
          {/* Submit Button for Manual Extras */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                // Show preview of what will be submitted
                const filledFields = Object.entries(manualExtras).filter(([key, value]) => value.trim() !== '');
                if (filledFields.length === 0) {
                  alert('Please fill at least one manual field before proceeding');
                  return;
                }
                
                setManualExtrasSaved(true);
                setUploadStatus('✅ Manual extras saved! Now drop your PDF to complete the upload.');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              💾 Save Manual Extras
            </button>
          </div>
          
          <div className="text-xs text-blue-600 mt-2">
            💡 Fill the fields above, click "Save Manual Extras", then drop your PDF. Both will be combined for review!
          </div>
        </div>

        {/* Workflow Step Indicator */}
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              manualExtrasSaved ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {manualExtrasSaved ? '✓' : '1'}
            </span>
            <span className={manualExtrasSaved ? 'text-green-800' : 'text-gray-600'}>
              {manualExtrasSaved ? 'Manual Extras Saved ✓' : 'Fill Manual Extras above and click "Save Manual Extras"'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <span className="w-6 h-6 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span className="text-gray-600">Drop your PDF below to complete the upload</span>
          </div>
        </div>

        <div 
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
            uploading ? 'border-indigo-400 bg-indigo-50 cursor-not-allowed' : 'border-zinc-300 hover:border-zinc-400'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".pdf" 
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <div className="space-y-4">
            <div className="text-6xl">📄</div>
            <div>
              <div className="text-xl font-medium">Drop PDF here or</div>
              <button 
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
                className={`font-medium ${uploading ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700'}`}
              >
                browse files
              </button>
            </div>
            <div className="text-sm text-zinc-500">PDF will be queued with your manual extras</div>
            {manualExtrasSaved && (
              <div className="text-sm text-green-600 font-medium">
                ✅ Manual extras ready! Drop PDF to continue
              </div>
            )}
          </div>
        </div>

        {uploadStatus && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-50 text-sm">
            {uploadStatus}
          </div>
        )}

        <div className="mt-6">
          <div className="text-sm font-medium mb-3">Upload History</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2">Time</th><th>Filename</th><th>Insurer</th><th>Size</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500">
                      No uploads yet. Drag and drop a PDF to get started.
                    </td>
                  </tr>
                ) : (
                  uploadedFiles.map((file) => (
                    <tr key={file.id} className="border-t">
                      <td className="py-2">{file.time}</td>
                      <td className="py-2">{file.filename}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          file.insurer === 'TATA_AIG' 
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {file.insurer === 'TATA_AIG' ? 'Tata AIG' : 'Digit'}
                        </span>
                      </td>
                      <td className="py-2">{file.size}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          file.status === 'UPLOADED'
                            ? 'bg-blue-100 text-blue-700'
                            : file.status === 'PROCESSING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : file.status === 'REVIEW'
                            ? 'bg-orange-100 text-orange-700'
                            : file.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : file.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {file.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          toast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✓' : '✗'}</span>
            <span>{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function LabeledInput({ label, placeholder, hint, required, value, onChange }: { label: string; placeholder?: string; hint?: string; required?: boolean; value?: any; onChange?: (v:any)=>void }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-600 mb-1">{label} {required && <span className="text-rose-600">*</span>} {hint && <span className="text-[10px] text-zinc-400">({hint})</span>}</div>
      <input value={value} onChange={e=>onChange && onChange(e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder={placeholder} />
    </label>
  )
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value?: any; onChange?: (v:any)=>void; options: string[] }) {
  return (
    <label className="block text-sm">
      <div className="text-xs text-zinc-600 mb-1">{label}</div>
      <select value={value} onChange={e=>onChange && onChange(e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        {options.map(o=> <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

// Optimized manual form with QuickFill and two-way cashback calc
function PageManualForm() {
  const [form, setForm] = useState<any>({
    insurer: "",
    productType: "",
    vehicleType: "",
    make: "",
    model: "",
    cc: "",
    manufacturingYear: "",
    policyNumber: "",
    vehicleNumber: "",
    issueDate: "",
    expiryDate: "",
    idv: "",
    ncb: "",
    discount: "",
    netOd: "",
    ref: "",
    totalOd: "",
    netPremium: "",
    totalPremium: "",
    cashbackPct: "",
    cashbackAmt: "",
    customerPaid: "",
    customerChequeNo: "",
    ourChequeNo: "",
    executive: "",
    callerName: "",
    mobile: "",
    rollover: "",
    remark: "",
    brokerage: "",
    cashback: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const set = (k:string,v:any)=> setForm((f:any)=>({ ...f, [k]: v }));
  const number = (v:any)=> (v===''||v===null)?0:parseFloat(v.toString().replace(/[^0-9.]/g,''))||0;

  // Two-way binding for cashback
  const onTotalChange = (v:any)=> {
    const tp = number(v);
    const pct = number(form.cashbackPct);
    const amt = pct? Math.round(tp * pct / 100): number(form.cashbackAmt);
    setForm({ ...form, totalPremium: v, cashbackAmt: amt?amt.toString():"" })
  }
  const onPctChange = (v:any)=> {
    const tp = number(form.totalPremium); const pct = number(v);
    const amt = tp? Math.round(tp * pct / 100): 0; setForm({ ...form, cashbackPct: v, cashbackAmt: amt?amt.toString():"" })
  }
  const onAmtChange = (v:any)=> {
    const tp = number(form.totalPremium); const amt = number(v);
    const pct = tp? ((amt/tp)*100).toFixed(1): ""; setForm({ ...form, cashbackAmt: v, cashbackPct: pct })
  }

  const quickFill = ()=> {
    // Demo: pretend we fetched last year policy by vehicle no
    setForm((f:any)=> ({ ...f,
      insurer: f.insurer || "Tata AIG",
      productType: f.productType || "Private Car",
      vehicleType: f.vehicleType || "Private Car",
      make: f.make || "Maruti",
      model: f.model || "Swift",
      cc: f.cc || "1197",
      manufacturingYear: f.manufacturingYear || "2021",
      idv: f.idv || "495000",
      ncb: f.ncb || "20",
      discount: f.discount || "0",
      netOd: f.netOd || "5400",
      ref: f.ref || "",
      totalOd: f.totalOd || "7200",
      netPremium: f.netPremium || "10800",
      totalPremium: f.totalPremium || "12150",
      brokerage: f.brokerage || "500",
      cashback: f.cashback || "600",
    }))
  }

  // Form submission handlers
  const handleSave = async () => {
    await submitForm(false);
  };

  const handleSaveAndNew = async () => {
    await submitForm(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNew();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const submitForm = async (clearAfterSave: boolean) => {
    // Clear previous messages
    setSubmitMessage(null);
    
    // Validate form
    if (errors.length > 0) {
      setSubmitMessage({ type: 'error', message: 'Please fix the errors before saving' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for API - including all fields
      const policyData = {
        policy_number: form.policyNumber,
        vehicle_number: form.vehicleNumber,
        insurer: form.insurer,
        product_type: form.productType || 'Private Car',
        vehicle_type: form.vehicleType || 'Private Car',
        make: form.make || 'Unknown',
        model: form.model || '',
        cc: form.cc || '',
        manufacturing_year: form.manufacturingYear || '',
        issue_date: form.issueDate || new Date().toISOString().split('T')[0],
        expiry_date: form.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        idv: parseFloat(form.idv) || 0,
        ncb: parseFloat(form.ncb) || 0,
        discount: parseFloat(form.discount) || 0,
        net_od: parseFloat(form.netOd) || 0,
        ref: form.ref || '',
        total_od: parseFloat(form.totalOd) || 0,
        net_premium: parseFloat(form.netPremium) || 0,
        total_premium: parseFloat(form.totalPremium),
        cashback_percentage: parseFloat(form.cashbackPct) || 0,
        cashback_amount: parseFloat(form.cashbackAmt) || 0,
        customer_paid: parseFloat(form.customerPaid) || 0,
        customer_cheque_no: form.customerChequeNo || '',
        our_cheque_no: form.ourChequeNo || '',
        executive: form.executive || 'Unknown',
        caller_name: form.callerName || 'Unknown',
        mobile: form.mobile || '0000000000',
        rollover: form.rollover || '',
        remark: form.remark || '',
        brokerage: parseFloat(form.brokerage) || 0,
        cashback: parseFloat(form.cashback) || 0,
        source: 'MANUAL_FORM'
      };

      // Submit to API

      const response = await policiesAPI.create(policyData);

      
      if (response.success) {
        setSubmitMessage({ 
          type: 'success', 
          message: `Policy saved successfully! Policy ID: ${response.data?.id || 'N/A'}` 
        });
        
        if (clearAfterSave) {
          // Reset form for new entry
          setForm({
            insurer: "",
            productType: "",
            vehicleType: "",
            make: "",
            model: "",
            cc: "",
            manufacturingYear: "",
            policyNumber: "",
            vehicleNumber: "",
            issueDate: "",
            expiryDate: "",
            idv: "",
            ncb: "",
            discount: "",
            netOd: "",
            ref: "",
            totalOd: "",
            netPremium: "",
            totalPremium: "",
            cashbackPct: "",
            cashbackAmt: "",
            customerPaid: "",
            customerChequeNo: "",
            ourChequeNo: "",
            executive: "",
            callerName: "",
            mobile: "",
            rollover: "",
            remark: "",
            brokerage: "",
            cashback: "",
          });
        }
      } else {
        setSubmitMessage({ 
          type: 'error', 
          message: response.error || 'Failed to save policy' 
        });
      }
    } catch (error) {
      setSubmitMessage({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const errors = useMemo(()=> {
    const e:string[] = [];
    if (!form.policyNumber) e.push("Policy Number is required");
    if (!form.vehicleNumber) e.push("Vehicle Number is required");
    if (!form.insurer) e.push("Company (Insurer) is required");
    if (!form.totalPremium) e.push("Total Premium is required");
    return e;
  }, [form])

  return (
    <>
      <Card title="Manual Entry — Speed Mode" desc="All required columns. QuickFill; Required-first; two-way cashback; sticky save bar">
        {/* Success/Error Messages */}
        {submitMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            submitMessage.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {submitMessage.message}
          </div>
        )}
        
        {/* Top row: Vehicle + QuickFill */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <LabeledInput label="Vehicle Number" required placeholder="KA01AB1234" value={form.vehicleNumber} onChange={v=>set('vehicleNumber', v)}/>
          <button onClick={quickFill} className="px-4 py-2 rounded-xl bg-indigo-600 text-white h-[42px] mt-6">Prefill from last policy</button>
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600"><Car className="w-4 h-4"/> Make/Model autofill in v1.1</div>
        </div>

        {/* Policy & Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="Policy Number" required value={form.policyNumber} onChange={v=>set('policyNumber', v)}/>
          <LabeledInput label="Insurer (Company)" required placeholder="e.g., Tata AIG" value={form.insurer} onChange={v=>set('insurer', v)}/>
          <LabeledSelect label="Product Type" value={form.productType} onChange={v=>set('productType', v)} options={["Private Car", "Commercial", "Two Wheeler", "Three Wheeler", "Bus", "Truck"]}/>
          <LabeledSelect label="Vehicle Type" value={form.vehicleType} onChange={v=>set('vehicleType', v)} options={["Private Car","GCV", "LCV", "MCV", "HCV"]}/>
          <LabeledInput label="Make" placeholder="Maruti / Hyundai / …" value={form.make} onChange={v=>set('make', v)}/>
          <LabeledInput label="Model" placeholder="Swift / i20 / …" value={form.model} onChange={v=>set('model', v)}/>
          <LabeledInput label="CC" hint="engine size" value={form.cc} onChange={v=>set('cc', v)}/>
          <LabeledInput label="MFG Year" value={form.manufacturingYear} onChange={v=>set('manufacturingYear', v)}/>
        </div>

        {/* Dates & Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <LabeledInput label="Issue Date" value={form.issueDate} onChange={v=>set('issueDate', v)}/>
          <LabeledInput label="Expiry Date" value={form.expiryDate} onChange={v=>set('expiryDate', v)}/>
          <LabeledInput label="IDV (₹)" value={form.idv} onChange={v=>set('idv', v)}/>
          <LabeledInput label="NCB (%)" value={form.ncb} onChange={v=>set('ncb', v)}/>
          <LabeledInput label="DIS (%)" hint="discount" value={form.discount} onChange={v=>set('discount', v)}/>
          <LabeledInput label="REF" hint="reference" value={form.ref} onChange={v=>set('ref', v)}/>
        </div>

        {/* Premiums */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <LabeledInput label="Net OD (₹)" hint="Own Damage" value={form.netOd} onChange={v=>set('netOd', v)}/>
          <LabeledInput label="Total OD (₹)" value={form.totalOd} onChange={v=>set('totalOd', v)}/>
          <LabeledInput label="Net Premium (₹)" value={form.netPremium} onChange={v=>set('netPremium', v)}/>
          <LabeledInput label="Total Premium (₹)" required value={form.totalPremium} onChange={onTotalChange}/>
        </div>

        {/* Cashback & Payments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <LabeledInput label="Cashback %" hint="auto-calculates amount" value={form.cashbackPct} onChange={onPctChange}/>
          <LabeledInput label="Cashback Amount (₹)" hint="fills when % given" value={form.cashbackAmt} onChange={onAmtChange}/>
          <LabeledInput label="Customer Paid (₹)" value={form.customerPaid} onChange={v=>set('customerPaid', v)}/>
          <LabeledInput label="Customer Cheque No" value={form.customerChequeNo} onChange={v=>set('customerChequeNo', v)}/>
          <LabeledInput label="Our Cheque No" value={form.ourChequeNo} onChange={v=>set('ourChequeNo', v)}/>
        </div>

        {/* Brokerage & Additional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <LabeledInput label="Brokerage (₹)" hint="commission amount" value={form.brokerage} onChange={v=>set('brokerage', v)}/>
          <LabeledInput label="Cashback (₹)" hint="total cashback amount" value={form.cashback} onChange={v=>set('cashback', v)}/>
        </div>

        {/* People & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <LabeledInput label="Executive" value={form.executive} onChange={v=>set('executive', v)}/>
          <LabeledInput label="Caller Name" value={form.callerName} onChange={v=>set('callerName', v)}/>
          <LabeledInput label="Mobile Number" required placeholder="9xxxxxxxxx" value={form.mobile} onChange={v=>set('mobile', v)}/>
          <LabeledInput label="Rollover/Renewal" hint="internal code" value={form.rollover} onChange={v=>set('rollover', v)}/>
          <LabeledInput label="Remark" placeholder="Any note" value={form.remark} onChange={v=>set('remark', v)}/>
        </div>

        {/* Assist panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-amber-50 text-amber-800 rounded-xl p-3 text-sm">
            <div className="font-medium mb-1">Error tray</div>
            {errors.length? <ul className="list-disc pl-5">{errors.map((e,i)=>(<li key={i}>{e}</li>))}</ul>:<div>No blocking errors.</div>}
          </div>
          <div className="bg-zinc-50 rounded-xl p-3 text-sm">
            <div className="font-medium mb-1">Shortcuts</div>
            <div>Ctrl+S save · Ctrl+Enter save & new · Alt+E first error</div>
          </div>
          <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm">
            <div className="font-medium mb-1">Smart autofill</div>
            <div>Typing a vehicle no. offers last-year data to copy.</div>
          </div>
        </div>

        <div className="sticky bottom-4 mt-4 flex gap-3 justify-end bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-2 rounded-xl">
          <button className="px-4 py-2 rounded-xl bg-white border">Save Draft</button>
          <button 
            onClick={handleSave} 
            disabled={errors.length > 0 || isSubmitting}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={handleSaveAndNew} 
            disabled={errors.length > 0 || isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save & New'}
          </button>
        </div>
      </Card>
    </>
  )
}

function PageManualGrid() {
  const rows = useMemo(() => [
    { src: "MANUAL_GRID", policy: "TA-9921", vehicle: "KA01AB1234", make: "Maruti", model: "Swift", insurer: "Tata AIG", total: 12150, cashback: 600, status: "OK" },
    { src: "MANUAL_GRID", policy: "DG-4410", vehicle: "KA05CJ7777", make: "Hyundai", model: "i20", insurer: "Digit", total: 11500, cashback: 500, status: "Error: Missing Issue Date" },
  ], [])
  return (
    <>
      <Card title="Grid Entry (Excel-like)" desc="Paste multiple rows; fix inline errors. Dedupe on Policy No. + Vehicle No.">
        <div className="mb-3 text-xs text-zinc-600">Tip: Copy from Excel and <b>Ctrl+V</b> directly here. Use <b>Ctrl+S</b> to save all.</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2">Source</th><th>Policy No.</th><th>Vehicle No.</th><th>Make</th><th>Model</th><th>Insurer</th><th>Total Premium</th><th>Cashback</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=> (
                <tr key={i} className="border-t">
                  <td className="py-2 text-xs text-zinc-500">{r.src}</td>
                  <td contentEditable className="outline-none px-1">{r.policy}</td>
                  <td contentEditable className="outline-none px-1">{r.vehicle}</td>
                  <td contentEditable className="outline-none px-1">{r.make}</td>
                  <td contentEditable className="outline-none px-1">{r.model}</td>
                  <td contentEditable className="outline-none px-1">{r.insurer}</td>
                  <td contentEditable className="outline-none px-1">{r.total}</td>
                  <td contentEditable className="outline-none px-1">{r.cashback}</td>
                  <td>{r.status.includes("Error") ? <span className="text-amber-700 bg-amber-100 px-2 py-1 rounded-full text-xs">{r.status}</span> : <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full text-xs">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-4">
          <button className="px-4 py-2 rounded-xl bg-zinc-900 text-white">Save All</button>
          <button className="px-4 py-2 rounded-xl bg-white border">Validate</button>
        </div>
      </Card>
    </>
  )
}

// NicsanCRMMock.tsx (top of component)
const LS_KEY = 'nicsan_crm_uploads';

type UploadRow = {
  id: string;
  filename: string;
  status?: 'UPLOADED' | 'PROCESSING' | 'REVIEW' | 'COMPLETED' | string;
  upload_status?: 'pending' | 'completed' | 'failed' | 'review';
  insurer?: string | null;
  s3_key: string;
  created_at?: string;
  extracted_data?: any;
};

const loadUploadsFromLS = (): UploadRow[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const saveUploadsToLS = (rows: UploadRow[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch {}
};

function PageReview({ user }: { user: {name:string; email?:string; role:"ops"|"founder"} }) {
  const [reviewData, setReviewData] = useState<any>(null);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [recentPolicies, setRecentPolicies] = useState<any[]>([]);
  const [selectedKind, setSelectedKind] = useState<'upload'|'policy'|null>(null);
  const [selectedId, setSelectedId] = useState<string|undefined>();
  const [selectedUploadId, setSelectedUploadId] = useState<string|undefined>();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string|undefined>();
  const [uploadId, setUploadId] = useState<string>('');
  const [pdfData, setPdfData] = useState<any>({});

  // keep previous list while fetching
  const [uploads, setUploads] = React.useState<UploadRow[]>(() => loadUploadsFromLS());
  const [isLoading, setIsLoading] = React.useState(false);
  const didInit = React.useRef(false);

  const refreshUploads = React.useCallback(async () => {
    console.log('🔄 refreshUploads called');
    setIsLoading(true);
    try {
      console.log('🔄 Calling uploadAPI.getUploads...');
      const resp = await uploadAPI.getUploads(1, 50, ['UPLOADED','PROCESSING','REVIEW','COMPLETED']);
      console.log('🔄 uploadAPI.getUploads response:', resp);
      if (Array.isArray(resp) && resp.length > 0) {
        // Merge server uploads with local uploads, avoiding duplicates
        const localUploads = loadUploadsFromLS();
        const serverIds = new Set(resp.map(u => u.id));
        const uniqueLocalUploads = localUploads.filter(u => !serverIds.has(u.id));
        const mergedUploads = [...resp, ...uniqueLocalUploads];
        
        setUploads(mergedUploads);
        saveUploadsToLS(mergedUploads);
        } else {
        // If no server uploads, just use local uploads
        const localUploads = loadUploadsFromLS();
        if (localUploads.length > 0) {
          setUploads(localUploads);
        }
        console.warn('No server uploads found, using local uploads only', resp);
      }
    } catch (e) {
      console.warn('getUploads error, keeping cached list', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (didInit.current) return; // guard StrictMode double run
    didInit.current = true;
    // kick off in background; UI already hydrated from LS
    refreshUploads();
  }, [refreshUploads]);

  const refreshRecentPolicies = async () => {
    try {
      const rec = await policiesAPI.getRecent(6);
      if (rec.success) setRecentPolicies(rec.data ?? []);
    } catch (e) {
      console.warn('refresh recent policies failed', e);
    }
  };

  // Load recent policies and pending uploads for grouped dropdown
  useEffect(() => {
    (async () => {
      await Promise.all([
        refreshUploads(),
        refreshRecentPolicies(),
      ]);
    })();
  }, []);

  // B) Ensure the dropdown's selected row = the one you just uploaded
  // Check for newly uploaded file and auto-select it
  useEffect(() => {
    const newlyUploadedId = localStorage.getItem('nicsan_crm_selected_upload_id');
    if (newlyUploadedId && uploads.length > 0) {
      // Find the upload in the list
      const upload = uploads.find(u => u.id === newlyUploadedId);
      if (upload) {
        // Auto-select the newly uploaded file
        setSelectedKey(`upload:${upload.id}`);
        setSelectedUploadId(upload.id);
        setSelectedId(upload.id);
        setSelectedKind('upload');
        setSelectedPolicyId(undefined);
        
        // Clear the flag so it doesn't auto-select again
        localStorage.removeItem('nicsan_crm_selected_upload_id');
        
        console.log(`[REVIEW] Auto-selected newly uploaded file: ${upload.filename} (${upload.id})`);
      }
    }
  }, [uploads]); // Run when uploads list changes

  const loadUploadData = async (uploadId: string) => {
    try {
      // In real app, this would fetch the actual upload data from backend
      const upload = uploads.find(u => u.id === uploadId);
      if (upload) {
        setReviewData(upload);
        setSubmitMessage({ 
          type: 'success', 
          message: 'Upload data loaded successfully! Please review before saving.' 
        });
      }
    } catch (error) {
      setSubmitMessage({ 
        type: 'error', 
        message: 'Failed to load upload data. Please try again.' 
      });
    }
  };

  // ========= OpenAI Extraction Functions =========
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionMeta, setExtractionMeta] = useState<any>(null);

  const handleExtractWithModel = async (model: 'primary' | 'secondary') => {
    if (!selectedUploadId) {
      setExtractionError('No upload selected');
      return;
    }
    
    try {
      setExtractionLoading(true);
      setExtractionError(null);
      
      const result = await extractAPI.extractPDF(selectedUploadId, model);
      
      if (result.success && result.data) {
        // Update form with extracted data
        setReviewData((prev: any) => ({
          ...prev,
          extracted_data: result.data
        }));
        setPdfData(result.data);
        setExtractionMeta(result.meta);
      setSubmitMessage({ 
        type: 'success', 
          message: `Extraction successful with ${model} model` 
        });
      } else {
        setExtractionError(result.error || 'Extraction failed');
        setSubmitMessage({ 
          type: 'error', 
          message: result.error || 'Extraction failed' 
        });
      }
    } catch (error) {
      const errorMsg = 'Extraction failed';
      setExtractionError(errorMsg);
      setSubmitMessage({ 
        type: 'error', 
        message: errorMsg 
      });
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleExtractOCR = async (uploadId: string) => {
    if (!uploadId) {
      setExtractionError('No upload selected');
      return;
    }
    
    try {
      setExtractionLoading(true);
      setExtractionError(null);
      
      const result = await extractAPI.extractOCR(uploadId);
      
      if (result.success && result.data) {
        // Update form with extracted data
        setReviewData((prev: any) => ({
          ...prev,
          extracted_data: result.data
        }));
        setPdfData(result.data);
        setExtractionMeta(result.meta);
        setSubmitMessage({ 
          type: 'success', 
          message: 'OCR extraction successful' 
        });
      } else {
        setExtractionError(result.error || 'OCR extraction failed');
        setSubmitMessage({ 
          type: 'error', 
          message: result.error || 'OCR extraction failed' 
        });
      }
    } catch (error) {
      const errorMsg = 'OCR extraction failed';
      setExtractionError(errorMsg);
      setSubmitMessage({ 
        type: 'error', 
        message: errorMsg 
      });
    } finally {
      setExtractionLoading(false);
    }
  };

  const EMPTY_EXTRACT = { manual_extras: {} };

  const handleLoadUploadData = async () => {
    if (!selectedKey) return;

    const [kind, a, b] = selectedKey.split(':');

    try {
      if (kind === 'upload') {
        const uploadId = a;
        const resp = await uploadAPI.getUploadById(uploadId);
        if (!resp?.success || !resp?.data) throw new Error('UPLOAD_FETCH_FAILED');
        
        const review = resp.data;
        setReviewData({ extracted_data: review.extracted_data ?? {} });
        setPdfData(review.extracted_data ?? {});
        setUploadId(review.id);
      setSubmitMessage({ 
        type: 'success', 
          message: 'Server upload data loaded successfully! Please review before saving.' 
        });
        return;
      }

      if (kind === 'local') {
        const uploadId = a;
        const local = uploads.find(u => String(u.id) === uploadId);
        if (!local) throw new Error('Local upload not found');
        
        // Use local data directly
        const extracted_data = local.extracted_data ?? {};
        setReviewData({ extracted_data });
        setPdfData(extracted_data);
        setUploadId(local.id);
        setSubmitMessage({ 
          type: 'success', 
          message: 'Local upload data loaded successfully! Please review before saving.' 
        });
        return;
      }

      if (kind === 'policy') {
        const policyId = a;
        const uploadId = b;
        if (!uploadId) {
          alert('This policy has no linked upload. Policy detail view not implemented yet.');
          return;
        }
        
        const resp = await uploadAPI.getUploadById(uploadId);
        if (!resp?.success || !resp?.data) throw new Error('UPLOAD_FETCH_FAILED');
        
        const review = resp.data;
        setReviewData({ extracted_data: review.extracted_data ?? {} });
        setPdfData(review.extracted_data ?? {});
        setUploadId(review.id);
        setSubmitMessage({ 
          type: 'success', 
          message: 'Policy upload data loaded successfully! Please review before saving.' 
        });
        return;
      }
    } catch (e) {
      console.error('Load upload failed', e);
      alert('Could not load upload data.');
    }
  };

  const handleConfirmAndSave = async () => {
    setIsLoading(true);
    setSaveMessage(null);
    try {
      if (!uploadId) {
        setSubmitMessage({ type: 'error', message: 'No upload selected' });
        return;
      }
      // Build a simple form object from current review data
      const form = {
        insurer: field('insurer'),
        policy_number: field('policy_number'),
        vehicle_number: field('vehicle_number'),
        issue_date: field('issue_date'),
        expiry_date: field('expiry_date'),
        total_premium: field('total_premium'),
        idv: field('idv'),
        product_type: 'MOTOR',
        vehicle_type: field('vehicle_type', 'PRIVATE'),
        make: field('make'),
        model: field('model'),
        variant: field('variant'),
        fuel_type: field('fuel_type'),
        executive: user?.name ?? 'OPS',
        caller_name: user?.name ?? 'NA',
        mobile: '0000000000', // Default mobile since user object doesn't have mobile
        manual_extras: reviewData?.extracted_data?.manual_extras || {},
      };

      const resp = await uploadAPI.confirmAndSave(uploadId, form);
      if (resp.success) {
        setSubmitMessage({ type: 'success', message: 'Policy confirmed and saved successfully!' });
        
        // Refresh both lists after successful save
        await Promise.all([
          refreshUploads(),          // repull pending
          refreshRecentPolicies(),   // repull recent 6
        ]);
        
        // Remove from available list and clear review view
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      setTimeout(() => {
        setReviewData(null);
        setSaveMessage(null);
        }, 800);
      } else {
        setSubmitMessage({ type: 'error', message: resp.error || 'Save failed' });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectToManual = () => {
    // In real app, this would redirect to manual form with some pre-filled data
    setReviewData(null);
    // You could navigate to manual form here
  };

  // For demo purposes, show mock data
  if (!reviewData && uploads.length === 0 && !isLoading) {
    return (
      <Card title="Review & Confirm" desc="Review PDF data + manual extras before saving">
        <div className="text-center py-8 text-zinc-500">
          <div className="text-6xl mb-4">📄</div>
          <div className="text-lg font-medium mb-2">No PDF data to review</div>
          <div className="text-sm">Upload a PDF with manual extras first to see the review screen.</div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-blue-700 text-sm">
            💡 <strong>Workflow:</strong> Go to PDF Upload → Fill Manual Extras → Save → Drop PDF → Come back here to Review
          </div>
          
          {/* Debug Info */}
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-yellow-700 text-sm">
            🔍 <strong>Debug:</strong> uploads.length = {uploads.length}
            <br />
            🔍 <strong>Debug:</strong> reviewData = {reviewData ? 'exists' : 'null'}
            <br />
            🔍 <strong>Debug:</strong> Check browser console for detailed logs
          </div>
          
          {/* Test Button */}
          <div className="mt-4">
            <button 
              onClick={() => {
                const testUpload = {
                  id: 'test_' + Date.now(),
                  filename: 'test_policy.pdf',
                  status: 'REVIEW',
                  s3_key: 'uploads/test/test_policy.pdf',
                  extracted_data: {
                    insurer: 'TATA_AIG',
                    status: 'REVIEW',
                    manual_extras: {
                      executive: "Test User",
                      callerName: "Test Caller",
                      mobile: "9876543210",
                      rollover: "TEST-2025",
                      remark: "Test upload for debugging",
                      brokerage: 500,
                      cashback: 600,
                      customerPaid: 11550,
                      customerChequeNo: "TEST-001",
                      ourChequeNo: "TEST-002"
                    },
                    extracted_data: {
                      policy_number: "TA-TEST",
                      vehicle_number: "KA01AB1234",
                      insurer: "Tata AIG",
                      product_type: "Private Car",
                      vehicle_type: "Private Car",
                      make: "Maruti",
                      model: "Swift",
                      cc: "1197",
                      manufacturing_year: "2021",
                      issue_date: "2025-08-14",
                      expiry_date: "2026-08-13",
                      idv: 495000,
                      ncb: 20,
                      discount: 0,
                      net_od: 5400,
                      ref: "",
                      total_od: 7200,
                      net_premium: 10800,
                      total_premium: 12150,
                      confidence_score: 0.86
                    }
                  }
                };
                
                localStorage.setItem('nicsan_crm_uploads', JSON.stringify([testUpload]));
                console.log('🧪 Added test upload:', testUpload);
                
                // Force reload
                window.location.reload();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              🧪 Add Test Upload (Debug)
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // Show upload selection if no specific upload is loaded and we have options
  if (!reviewData && (uploads.length > 0 || recentPolicies.length > 0 || isLoading)) {
    return (
      <Card title="Review & Confirm" desc="Select an upload to review">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            💡 <strong>Workflow:</strong> PDF Upload → Manual Extras → Review & Confirm → Save to Database
            {isLoading && (
              <div className="mt-2 text-xs text-blue-600">
                🔄 Loading uploads...
              </div>
            )}
          </div>
        </div>
        
        {/* Debug Info */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            🔍 <strong>Debug:</strong> Found {uploads.length} uploads, {recentPolicies.length} recent policies {isLoading && '(loading...)'}
            {(uploads.length > 0 || recentPolicies.length > 0) && (
              <div className="mt-2 text-xs">
                <div><strong>Uploads:</strong> {uploads.map(u => u.filename).join(', ')}</div>
                <div><strong>Recent:</strong> {recentPolicies.map(p => p.policy_number).join(', ')}</div>
              </div>
            )}
          </div>
        </div>
        <div className="mb-6 p-4 bg-zinc-50 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">📄 Select Upload to Review</div>
            <button 
              onClick={() => {
                console.log('🔄 Refresh button clicked');
                // Force reload available uploads from localStorage
                const loadAvailableUploads = async () => {
                  try {
                    const storedUploads = localStorage.getItem('nicsan_crm_uploads');
                    if (storedUploads) {
                      const realUploads = JSON.parse(storedUploads);

                      setUploads(realUploads);
                    } else {

                    }
                  } catch (error) {
                    console.error('Failed to refresh uploads:', error);
                  }
                };
                loadAvailableUploads();
              }}
              className="px-3 py-1 text-xs bg-zinc-200 hover:bg-zinc-300 rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="flex items-center gap-3">
            <select 
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={selectedKey}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedKey(val);

                const [kind, a, b] = val.split(':');

                if (kind === 'upload') {
                  setSelectedUploadId(a);
                  setSelectedPolicyId(undefined);
                  setSelectedId(a);
                  setSelectedKind('upload');
                  return;
                }

                if (kind === 'local') {
                  setSelectedUploadId(a);
                  setSelectedPolicyId(undefined);
                  setSelectedId(a);
                  setSelectedKind('upload');
                  return;
                }

                if (kind === 'policy') {
                  const policyId = a;
                  const uploadId = b; // might be undefined for old rows
                  if (!uploadId) {
                    alert('This policy has no linked upload. Policy detail view not implemented yet.');
                    return;
                  }
                  setSelectedPolicyId(policyId);
                  setSelectedUploadId(uploadId);
                  setSelectedId(uploadId);
                  setSelectedKind('policy');
                }
              }}
            >
              <option value="">Select an upload to review…</option>

              {/* Uploads */}
              {uploads.length > 0 && (
                <optgroup label="📄 Uploads">
                  {uploads.map(u => (
                    <option key={`upload:${u.id}`} value={`upload:${u.id}`}>
                      {u.filename} - {u.status || u.upload_status || 'UNKNOWN'}
                </option>
              ))}
                </optgroup>
              )}

              {/* Recent policies (only if they have a linked upload_id) */}
              {recentPolicies.length > 0 && (
                <optgroup label="Recent policies">
                  {recentPolicies
                    .filter(p => !!p.upload_id) // disable ones without a link
                    .map(p => (
                      <option key={`policy:${p.id}:${p.upload_id}`} value={`policy:${p.id}:${p.upload_id}`}>
                        {p.policy_number || 'NA'} · Veh {p.vehicle_number || 'NA'} ({p.insurer})
                      </option>
                    ))}
                  {recentPolicies
                    .filter(p => !p.upload_id) // show ones without upload_id as disabled
                    .map(p => (
                      <option key={`policy:${p.id}`} value={`policy:${p.id}`} disabled>
                        {p.policy_number || 'NA'} · Veh {p.vehicle_number || 'NA'} ({p.insurer}) — no linked upload
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            <button 
              onClick={handleLoadUploadData}
              disabled={!selectedKey}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load Upload Data
            </button>
          </div>
          
          {/* OpenAI Extraction Buttons */}
          <div className="flex gap-2 mt-3">
            <button 
              onClick={() => handleExtractWithModel('primary')}
              disabled={extractionLoading || !selectedUploadId}
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {extractionLoading ? 'Extracting...' : 'Extract (Fast)'}
            </button>
            <button 
              onClick={() => handleExtractWithModel('secondary')}
              disabled={extractionLoading || !selectedUploadId}
              className="px-4 py-2 bg-green-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {extractionLoading ? 'Extracting...' : 'Extract (Secondary)'}
            </button>
          </div>
          
          {extractionError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {extractionError}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Guard the Review UI so it doesn't crash when API is down/empty
  if (!selectedKey) {
    return <div className="text-sm text-gray-500">Pick an item above and click "Load Upload Data".</div>;
  }

  if (isLoading) {
    return <div>Loading upload data…</div>;
  }

  if (!reviewData && !pdfData) {
    return <div className="text-red-600 text-sm">Could not load upload data.</div>;
  }

  // Prevent undefined dereferences
  const safePdfData = pdfData ?? {};
  const safeReview = reviewData ?? {};
  const extracted = safeReview.extracted_data ?? {};   // <- use this instead of `data`
  const manualExtras = extracted.manual_extras ?? {};

  // Small helper so templates stay clean
  const field = (k: string, fallback: any = '') =>
    extracted?.[k]?.value ?? safePdfData?.[k] ?? fallback;

  // OCR suggestion helper
  function hasVal(v?: any) {
  const s = v?.value ?? null;
  if (s === null) return false;
  return String(s).trim().length > 0;
}

function shouldSuggestOCR(extraction?: { data?: any; meta?: any }) {
  if (!extraction?.meta || !extraction?.data) return false;

  const isFast = extraction.meta.via === 'fast';
  const chars = Number(extraction.meta.pdfTextChars ?? 0);

  // Key IDs missing?
  const missingPolicy = !hasVal(extraction.data.policy_number);
  const missingReg    = !hasVal(extraction.data.vehicle_number);

  // Optional: consider premiums/IDV too (stronger nudge)
  const missingPrem   = !hasVal(extraction.data.total_premium);
  const missingIDV    = !hasVal(extraction.data.idv);

  // Thresholds (tweakable)
  const CHAR_THRESHOLD = 500;  // text is "thin" below this
  const NEEDS_OCR = (missingPolicy && missingReg) || (missingPrem && missingIDV);

  return isFast && chars < CHAR_THRESHOLD && NEEDS_OCR;
}
  
  // Guard UI when upload is still processing
  if (selectedKind === 'upload' && selectedId) {
    const currentUpload = uploads.find(u => u.id === selectedId);
    if (currentUpload?.status === 'PROCESSING' || currentUpload?.upload_status === 'pending') {
      return (
        <Card title="Review & Confirm" desc="Review PDF data + manual extras before saving">
          <div className="p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-900">
            The upload is still processing. Please refresh in a few seconds.
          </div>
        </Card>
      );
    }
  }
  
  // Safety check - if no data, show error
  if (!reviewData) {
    return (
      <Card title="Review & Confirm" desc="Review PDF data + manual extras before saving">
        <div className="text-center py-8 text-red-500">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-lg font-medium mb-2">Data Error</div>
          <div className="text-sm">No valid data found for review. Please try selecting an upload again.</div>
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
            🔍 <strong>Debug:</strong> reviewData = {JSON.stringify(reviewData, null, 2)}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Review & Confirm" desc="Review PDF data + manual extras before saving">
        {/* Success/Error Messages */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            saveMessage.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage.message}
          </div>
        )}

        {/* File Info */}
        <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <div><span className="font-medium">File:</span> {safeReview.filename ?? ''}</div>
            <div><span className="font-medium">Status:</span> {safeReview.status ?? ''}</div>
            <div><span className="font-medium">S3 Key:</span> {safeReview.s3_key ?? ''}</div>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="mb-4 p-3 rounded-lg bg-zinc-50">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">AI Confidence Score:</div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              (field('confidence_score', 0)) >= 0.8 
                ? 'bg-green-100 text-green-700'
                : (field('confidence_score', 0)) >= 0.6
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {Math.round((field('confidence_score', 0)) * 100)}%
            </span>
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {(field('confidence_score', 0)) >= 0.8 
              ? 'High confidence - data looks good'
              : (field('confidence_score', 0)) >= 0.6
              ? 'Medium confidence - please review carefully'
              : 'Low confidence - manual review required'
            }
          </div>
        </div>

        {/* PDF Extracted Data Section */}
        <div className="mb-6">
          <div className="text-sm font-medium mb-3 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            📄 PDF Extracted Data (AI Confidence: {Math.round((field('confidence_score', 0)) * 100)}%)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput 
              label="Policy Number" 
              value={field('policy_number')}
              onChange={() => {}} // Read-only for review
              hint="auto-read from PDF"
            />
            <LabeledInput 
              label="Vehicle Number" 
              value={field('vehicle_number')}
              onChange={() => {}} // Read-only for review
              hint="check format"
            />
            <LabeledInput 
              label="Insurer" 
              value={field('insurer')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Product Type" 
              value={field('product_type')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Make" 
              value={field('make')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Model" 
              value={field('model')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="CC" 
              value={field('cc')}
              onChange={() => {}} // Read-only for review
              hint="engine size"
            />
            <LabeledInput 
              label="Manufacturing Year" 
              value={field('manufacturing_year')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Issue Date" 
              value={field('issue_date')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Expiry Date" 
              value={field('expiry_date')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="IDV (₹)" 
              value={field('idv')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="NCB (%)" 
              value={field('ncb')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Discount (%)" 
              value={field('discount')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Net OD (₹)" 
              value={field('net_od')}
              onChange={() => {}} // Read-only for review
              hint="Own Damage"
            />
            <LabeledInput 
              label="Total OD (₹)" 
              value={field('total_od')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Net Premium (₹)" 
              value={field('net_premium')}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Total Premium (₹)" 
              value={field('total_premium')}
              onChange={() => {}} // Read-only for review
            />
          </div>
        </div>

        {/* Extraction Metadata */}
        <MetaLine meta={extractionMeta} />

        {/* OCR Suggestion Banner */}
        {shouldSuggestOCR({ data: extracted, meta: extractionMeta }) && selectedUploadId && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
            <div className="text-sm text-sky-800">
              Text looks thin. Want to try <b>OCR Fallback</b> for this PDF?
            </div>
            <button
              className="px-3 py-1 rounded bg-sky-700 text-white"
              onClick={() => handleExtractOCR(selectedUploadId)}
            >
              Use OCR Fallback
            </button>
          </div>
        )}

        {/* Manual Extras Section */}
        <div className="mb-6">
          <div className="text-sm font-medium mb-3 text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
            ✏️ Manual Extras (from Sales Rep)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput 
              label="Executive" 
              value={manualExtras.executive}
              onChange={() => {}} // Read-only for review
              hint="sales rep name"
            />
            <LabeledInput 
              label="Caller Name" 
              value={manualExtras.callerName}
              onChange={() => {}} // Read-only for review
              hint="telecaller name"
            />
            <LabeledInput 
              label="Mobile Number" 
              value={manualExtras.mobile}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Rollover/Renewal" 
              value={manualExtras.rollover}
              onChange={() => {}} // Read-only for review
              hint="internal code"
            />
            <LabeledInput 
              label="Brokerage (₹)" 
              value={manualExtras.brokerage}
              onChange={() => {}} // Read-only for review
              hint="commission amount"
            />
            <LabeledInput 
              label="Cashback (₹)" 
              value={manualExtras.cashback}
              onChange={() => {}} // Read-only for review
              hint="total cashback"
            />
            <LabeledInput 
              label="Customer Paid (₹)" 
              value={manualExtras.customerPaid}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Customer Cheque No" 
              value={manualExtras.customerChequeNo}
              onChange={() => {}} // Read-only for review
            />
            <LabeledInput 
              label="Our Cheque No" 
              value={manualExtras.ourChequeNo}
              onChange={() => {}} // Read-only for review
            />
            <div className="md:col-span-2">
              <LabeledInput 
                label="Remark" 
                value={manualExtras.remark}
                onChange={() => {}} // Read-only for review
                hint="additional notes"
              />
            </div>
          </div>
        </div>

        {/* Issues Section */}
        <div className="mb-6">
          <div className="text-sm font-medium mb-2">Issues & Warnings</div>
          <div className="space-y-2">
            {(field('confidence_score', 0)) < 0.8 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600"/> 
                <span>Low confidence score. Please verify all extracted data.</span>
              </div>
            )}
            {!field('issue_date') && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600"/> 
                <span>Issue Date missing. Please add manually.</span>
              </div>
            )}
            {!field('expiry_date') && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600"/> 
                <span>Expiry Date missing. Please add manually.</span>
              </div>
            )}
            {!manualExtras.executive && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600"/> 
                <span>Executive name missing. Please add manually.</span>
              </div>
            )}
            {!manualExtras.mobile && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600"/> 
                <span>Mobile number missing. Please add manually.</span>
              </div>
            )}
            {(field('confidence_score', 0)) >= 0.8 && manualExtras.executive && manualExtras.mobile && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600"/> 
                <span>Data looks good! High confidence extraction + complete manual extras.</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={handleConfirmAndSave} 
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Confirm & Save'}
          </button>
          <button 
            onClick={handleRejectToManual} 
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject to Manual
          </button>
        </div>

        {/* Recent Policies Section */}
        <section className="mt-6">
          <h3 className="text-lg font-semibold">Recent Policies (last 6)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {recentPolicies.map(p => (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="text-sm opacity-70">{p.insurer} · {p.product_type}/{p.vehicle_type}</div>
                <div className="font-semibold">{p.policy_number || 'NA'}</div>
                <div className="text-sm">Veh: {p.vehicle_number || 'NA'}</div>
                <div className="text-sm">Issue → Exp: {p.issue_date || '—'} → {p.expiry_date || '—'}</div>
                <div className="text-sm">IDV: {p.idv ?? 0} · Premium: {p.total_premium ?? 0}</div>
                <div className="text-xs opacity-60">By: {p.executive || 'OPS'} / {p.caller_name || 'NA'}</div>
              </div>
            ))}
          </div>
        </section>
      </Card>
    </>
  )
}

function PagePolicyDetail() {
  return (
    <Card title="Policy Detail — KA01AB1234" desc="(Audit trail = log of changes; RBAC = who can see/do what)">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 bg-zinc-50 rounded-xl p-4">
          <div className="text-sm font-medium mb-2">Core Fields</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Policy No.: <b>TA-9921</b></div>
            <div>Insurer: <b>Tata AIG</b></div>
            <div>Issue: <b>2025-08-10</b></div>
            <div>Expiry: <b>2026-08-09</b></div>
            <div>Total Premium: <b>₹12,150</b></div>
            <div>NCB: <b>20%</b></div>
          </div>
        </div>
        <div className="bg-zinc-50 rounded-xl p-4">
          <div className="text-sm font-medium mb-2">Activity Timeline</div>
          <ol className="text-sm space-y-2">
            <li>2025-08-12 15:54 — Parsed PDF (98%)</li>
            <li>2025-08-12 15:56 — Confirmed by Ops (user: Priya)</li>
            <li>2025-08-12 15:57 — Audit log saved</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}

// ---------- FOUNDER ----------
function FounderSidebar({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  const items = [
    { id: "overview", label: "Company Overview", icon: LayoutDashboard },
    { id: "kpis", label: "KPI Dashboard", icon: TrendingUp },
    { id: "leaderboard", label: "Rep Leaderboard", icon: Users },
    { id: "explorer", label: "Sales Explorer", icon: BarChart3 },
    { id: "sources", label: "Data Sources", icon: BarChart3 },
    { id: "tests", label: "Dev/Test", icon: SlidersHorizontal },
    { id: "settings", label: "Settings", icon: Settings },
  ]
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-2 sticky top-20">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setPage(id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${page===id?"bg-zinc-900 text-white":"hover:bg-zinc-100"}`}>
          <Icon className="w-4 h-4"/> {label}
        </button>
      ))}
      <div className="px-3 pt-2 text-[11px] text-zinc-500">Definitions in (brackets). Example: GWP = Gross Written Premium.</div>
    </div>
  )
}

const demoTrend = Array.from({length: 14}).map((_,i)=> ({ day: `D-${14-i}`, gwp: 80000 + i*2500 + (i%3?3000:0), net: 65000 + i*2100 }))
const demoSources = [
  { name: "PDF_TATA", policies: 62, gwp: 725000 },
  { name: "PDF_DIGIT", policies: 58, gwp: 690000 },
  { name: "MANUAL_FORM", policies: 40, gwp: 410000 },
  { name: "MANUAL_GRID", policies: 60, gwp: 620000 },
  { name: "CSV_IMPORT", policies: 200, gwp: 2050000 },
]
const demoReps = [
  { name: "Asha", leads: 120, converted: 22, gwp: 260000, brokerage: 39000, cashback: 10000, net: 29000, cac: Math.round(1800 / 22) },
  { name: "Vikram", leads: 110, converted: 18, gwp: 210000, brokerage: 31500, cashback: 9000, net: 22500, cac: Math.round(1800 / 18) },
  { name: "Meera", leads: 90, converted: 20, gwp: 240000, brokerage: 36000, cashback: 8000, net: 28000, cac: Math.round(1800 / 20) },
]
const demoPolicies = [
  { rep: 'Asha', make: 'Maruti', model: 'Swift', policies: 12, gwp: 130000, cashbackPctAvg: 2.4, cashback: 3100, net: 16900 },
  { rep: 'Asha', make: 'Hyundai', model: 'i20', policies: 10, gwp: 130000, cashbackPctAvg: 1.9, cashback: 2500, net: 17500 },
  { rep: 'Vikram', make: 'Hyundai', model: 'i20', policies: 9, gwp: 115000, cashbackPctAvg: 1.1, cashback: 1200, net: 17100 },
  { rep: 'Meera', make: 'Maruti', model: 'Baleno', policies: 11, gwp: 125000, cashbackPctAvg: 0.9, cashback: 1100, net: 17800 },
]

// ---- KPI helpers ----
const fmtINR = (n:number)=> `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n:number)=> `${(n).toFixed(1)}%`;

function PageOverview() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="GWP" info="(Gross Written Premium)" value="₹10.7L" sub="▲ 8% vs last 14d"/>
        <Tile label="Brokerage" info="(% of GWP)" value="₹1.60L"/>
        <Tile label="Cashback" info="(Cash we give back)" value="₹0.34L"/>
        <Tile label="Net" info="(Brokerage − Cashback)" value="₹1.26L"/>
      </div>
      <Card title="14-day Trend" desc="GWP & Net (pre-calculated = materialized view)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={demoTrend}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis dataKey="day"/>
              <YAxis/>
              <Tooltip/>
              <Area type="monotone" dataKey="gwp" stroke="#6366f1" fill="url(#g1)" name="GWP"/>
              <Area type="monotone" dataKey="net" stroke="#10b981" fill="url(#g2)" name="Net"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}

function PageLeaderboard() {
  return (
    <Card title="Rep Leaderboard" desc="Lead→Sale % = Converted / Leads Assigned; CAC/policy = daily rep cost / converted">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 p-1">
          <button className="px-3 py-1 rounded-lg bg-white shadow text-sm">Last 14d</button>
          <button className="px-3 py-1 rounded-lg text-sm text-zinc-600">MTD</button>
          <button className="px-3 py-1 rounded-lg text-sm text-zinc-600">Last 90d</button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Filter className="w-4 h-4"/> <span>Sort by</span>
          <select className="border rounded-lg px-2 py-1">
            <option>Net</option>
            <option>Least Cashback %</option>
            <option>Net per ₹ Cashback</option>
          </select>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Telecaller</th><th>Leads Assigned</th><th>Converted</th><th>GWP</th><th>Brokerage</th><th>Cashback</th><th>Net</th><th>Lead→Sale %</th><th>CAC/Policy</th>
            </tr>
          </thead>
          <tbody>
            {demoReps.map((r,i)=> (
              <tr key={i} className="border-t">
                <td className="py-2 font-medium">{r.name}</td>
                <td>{r.leads}</td>
                <td>{r.converted}</td>
                <td>₹{(r.gwp/1000).toFixed(1)}k</td>
                <td>₹{(r.brokerage/1000).toFixed(1)}k</td>
                <td>₹{(r.cashback/1000).toFixed(1)}k</td>
                <td>₹{(r.net/1000).toFixed(1)}k</td>
                <td>{((r.converted/(r.leads||1))*100).toFixed(1)}%</td>
                <td>₹{(r.cac).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PageExplorer() {
  const [make, setMake] = useState("All");
  const [model, setModel] = useState("All");
  const [insurer, setInsurer] = useState("All");
  const [cashbackMax, setCashbackMax] = useState(5);
  const makes = ["All","Maruti","Hyundai","Tata","Toyota"];
  const models = ["All","Swift","Baleno","i20","Altroz"];
  const insurers = ["All","Tata AIG","Digit","ICICI"];

  const filtered = demoPolicies.filter(p => (make==='All'||p.make===make) && (model==='All'||p.model===model) && (insurer==='All'/* demo */) && (p.cashbackPctAvg <= cashbackMax));
  return (
    <>
      <Card title="Sales Explorer (Motor)" desc="Filter by Make/Model; find reps with most sales and lowest cashback">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <label className="text-sm">Make<select value={make} onChange={e=>setMake(e.target.value)} className="w-full border rounded-xl px-2 py-2 mt-1">{makes.map(m=><option key={m}>{m}</option>)}</select></label>
          <label className="text-sm">Model<select value={model} onChange={e=>setModel(e.target.value)} className="w-full border rounded-xl px-2 py-2 mt-1">{models.map(m=><option key={m}>{m}</option>)}</select></label>
          <label className="text-sm">Insurer<select value={insurer} onChange={e=>setInsurer(e.target.value)} className="w-full border rounded-xl px-2 py-2 mt-1">{insurers.map(m=><option key={m}>{m}</option>)}</select></label>
          <label className="text-sm col-span-2">Max Cashback %
            <input type="range" min={0} max={10} value={cashbackMax} onChange={e=>setCashbackMax(parseInt(e.target.value))} className="w-full"/>
            <div className="text-xs text-zinc-600 mt-1">{cashbackMax}%</div>
          </label>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2">Rep</th><th>Make</th><th>Model</th><th># Policies</th><th>GWP</th><th>Avg Cashback %</th><th>Cashback (₹)</th><th>Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i)=> (
                <tr key={i} className="border-t">
                  <td className="py-2 font-medium">{r.rep}</td>
                  <td>{r.make}</td>
                  <td>{r.model}</td>
                  <td>{r.policies}</td>
                  <td>₹{(r.gwp/1000).toFixed(1)}k</td>
                  <td>{r.cashbackPctAvg}%</td>
                  <td>₹{r.cashback}</td>
                  <td>₹{r.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-zinc-600 mt-2">Tip: Sort by <b>Net per ₹ Cashback</b> to find "most sales with least cashback".</div>
      </Card>
    </>
  )
}

function PageSources() {
  return (
    <Card title="Contribution by Data Source" desc="Compare PDF vs Manual vs CSV (ingestion source = where data came from)">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demoSources}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Legend/>
            <Bar dataKey="policies" name="# Policies" fill="#6366f1"/>
            <Bar dataKey="gwp" name="GWP" fill="#10b981"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function PageFounderSettings() {
  return (
    <Card title="Business Settings" desc="These drive calculations in dashboards.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LabeledInput label="Brokerage %" hint="% of GWP that we earn"/>
        <LabeledInput label="Rep Daily Cost (₹)" hint="salary + incentives + telephony + tools / working days"/>
        <LabeledInput label="Expected Conversion %" hint="for valuing backlog"/>
        <LabeledInput label="Premium Growth %" hint="for LTV estimates later"/>
      </div>
      <div className="flex gap-3 mt-4">
        <button className="px-4 py-2 rounded-xl bg-zinc-900 text-white">Save Settings</button>
        <button className="px-4 py-2 rounded-xl bg-white border">Reset</button>
      </div>
    </Card>
  )
}

// ---------- KPI DASHBOARD ----------
function PageKPIs() {
  // Aggregate demo numbers
  const totalLeads = demoReps.reduce((a,b)=>a+b.leads,0);
  const totalConverted = demoReps.reduce((a,b)=>a+b.converted,0);
  const sumGWP = demoReps.reduce((a,b)=>a+b.gwp,0);
  const sumNet = demoReps.reduce((a,b)=>a+b.net,0);

  // Assumptions for demo period (14 days)
  const days = 14;
  const reps = demoReps.length;
  const repDailyCost = 1800; // ₹ per rep per day
  const repCost = repDailyCost * reps * days; // total sales payroll this period
  const marketingSpend = 80000; // ₹ for this period
  const underwritingExpenses = 55000; // other ops/overheads for this period
  const claimsIncurred = 0.58 * sumGWP; // demo loss ratio ~58%

  // Calculations
  const conversionRate = (totalConverted/(totalLeads||1))*100;
  const costPerLead = marketingSpend/(totalLeads||1);
  const CAC = (marketingSpend + repCost)/(totalConverted||1);
  const ARPA = sumNet/(totalConverted||1); // using Net as revenue per account
  const retentionRate = 78; // % demo
  const churnRate = 100 - retentionRate;
  const lifetimeMonths = 24; // demo assumption
  const CLV = ARPA * lifetimeMonths; // rough
  const LTVtoCAC = CLV/(CAC||1);
  const lossRatio = (claimsIncurred/(sumGWP||1))*100;
  const expenseRatio = ((underwritingExpenses + marketingSpend + repCost)/(sumGWP||1))*100;
  const combinedRatio = lossRatio + expenseRatio;
  const upsellRate = 8.0; // % demo
  const NPS = 62; // demo
  const marketingAttributedRevenue = sumNet * 0.7; // attribute 70% of net to mktg for demo
  const marketingROI = ((marketingAttributedRevenue - marketingSpend)/(marketingSpend||1))*100;
  const revenueGrowthRate = ((demoTrend[demoTrend.length-1].gwp - demoTrend[0].gwp)/(demoTrend[0].gwp||1))*100;

  return (
    <>
      <div className="grid grid-cols-1 gap-6">
        {/* Acquisition */}
        <Card title="Acquisition" desc="Conversion, lead cost, CAC, growth">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Tile label="Conversion Rate" info="(% leads → sales)" value={pct(conversionRate)} sub={`${totalConverted}/${totalLeads} deals`}/>
            <Tile label="Cost per Lead" info="(₹ spend ÷ leads)" value={fmtINR(costPerLead)} sub={`Mktg ₹${marketingSpend.toLocaleString('en-IN')}`}/>
            <Tile label="CAC" info="(Cost to acquire 1 sale)" value={fmtINR(CAC)} sub={`Rep ₹${repCost.toLocaleString('en-IN')} + Mktg`}/>
            <Tile label="Revenue Growth" info="(% vs start of period)" value={pct(revenueGrowthRate)} />
          </div>
        </Card>

        {/* Value & Retention */}
        <Card title="Value & Retention" desc="ARPA, retention/churn, LTV, LTV/CAC">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Tile label="ARPA" info="(avg revenue per account)" value={fmtINR(ARPA)} />
            <Tile label="Retention" info="(% customers kept)" value={pct(retentionRate)} />
            <Tile label="Churn" info="(100 − retention)" value={pct(churnRate)} />
            <Tile label="CLV (approx)" info="(ARPA × lifetime months)" value={fmtINR(CLV)} sub={`${lifetimeMonths} mo`} />
            <Tile label="LTV/CAC" info= "(value per customer ÷ cost)" value={`${LTVtoCAC.toFixed(2)}×`} />
          </div>
        </Card>

        {/* Insurance Health */}
        <Card title="Insurance Health" desc="Loss, Expense, Combined ratio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Tile label="Loss Ratio" info="(claims ÷ premium)" value={pct(lossRatio)} sub={`Claims ${fmtINR(claimsIncurred)}`}/>
            <Tile label="Expense Ratio" info="(expenses ÷ premium)" value={pct(expenseRatio)} sub={`Ops+Mktg+Rep`}/>
            <Tile label="Combined Ratio" info="(loss + expense)" value={pct(combinedRatio)} />
          </div>
        </Card>

        {/* Sales Quality */}
        <Card title="Sales Quality" desc="Upsell/Cross-sell, NPS, Marketing ROI">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Tile label="Upsell/Cross-sell" info="(% with extra cover)" value={pct(upsellRate)} />
            <Tile label="NPS" info="(promoters − detractors)" value={`${NPS}`} sub="survey"/>
            <Tile label="Marketing ROI" info="((Rev−Spend) ÷ Spend)" value={pct(marketingROI)} />
          </div>
        </Card>
      </div>
    </>
  )
}

// ---------- DEV/TESTS ----------
function PageTests() {
  // Simple run-time tests for core form math (no framework)
  type Case = { name: string; total: number; pct?: number; amt?: number; expectAmt?: number; expectPct?: number };
  const cases: Case[] = [
    { name: "pct→amt", total: 10000, pct: 10, expectAmt: 1000 },
    { name: "amt→pct", total: 20000, amt: 500, expectPct: 2.5 },
    { name: "zero-total", total: 0, pct: 10, expectAmt: 0 },
  ];
  const results = cases.map(c => {
    const calcAmt = c.pct != null ? Math.round((c.total * c.pct) / 100) : (c.amt ?? 0);
    const calcPct = c.amt != null && c.total > 0 ? +( (c.amt / c.total) * 100 ).toFixed(1) : (c.pct ?? 0);
    const passAmt = c.expectAmt == null || c.expectAmt === calcAmt;
    const passPct = c.expectPct == null || c.expectPct === calcPct;
    return { ...c, calcAmt, calcPct, pass: passAmt && passPct };
  });
  const allPass = results.every(r => r.pass);
  return (
    <Card title="Dev/Test" desc="Lightweight checks for cashback math">
      <div className="text-sm mb-2">Overall: {allPass ? <span className="text-emerald-700">✅ PASS</span> : <span className="text-rose-700">❌ FAIL</span>}</div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Case</th><th>Total</th><th>Input %</th><th>Input ₹</th><th>Calc ₹</th><th>Calc %</th><th>Expected ₹</th><th>Expected %</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r,i)=> (
              <tr key={i} className="border-t">
                <td className="py-2">{r.name}</td>
                <td>{r.total}</td>
                <td>{r.pct ?? "—"}</td>
                <td>{r.amt ?? "—"}</td>
                <td>{r.calcAmt}</td>
                <td>{r.calcPct}</td>
                <td>{r.expectAmt ?? "—"}</td>
                <td>{r.expectPct ?? "—"}</td>
                <td>{r.pass ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function NicsanCRMMock() {
  const [user, setUser] = useState<{name:string; email?:string; role:"ops"|"founder"}|null>(null);
  const [tab, setTab] = useState<"ops"|"founder">("ops");
  const [opsPage, setOpsPage] = useState("upload");
  const [founderPage, setFounderPage] = useState("overview");



  if (!user) return <LoginPage onLogin={(u)=>{ 
    setUser(u); 
    setTab(u.role==='founder'?'founder':'ops');
  }}/>

  return (
    <div className="min-h-screen bg-zinc-50">
      <TopTabs tab={tab} setTab={setTab} user={user} onLogout={()=>setUser(null)} />
      {tab === "ops" ? (
        <Shell sidebar={<OpsSidebar page={opsPage} setPage={setOpsPage} />}>
          {opsPage === "upload" && <PageUpload/>}
          {opsPage === "review" && (
            <ErrorBoundary>
              <PageReview user={user}/>
            </ErrorBoundary>
          )}
          {opsPage === "manual-form" && <PageManualForm/>}
          {opsPage === "manual-grid" && <PageManualGrid/>}
          {opsPage === "policy-detail" && <PagePolicyDetail/>}
          {opsPage === "settings" && (
            <Card title="Ops Settings" desc="Keyboard shortcuts + defaults (makes data entry faster)">
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li><b>Hotkeys</b>: Ctrl+S (save), Ctrl+Enter (save & next), Alt+E (jump to first error)</li>
                <li><b>Autofill</b>: Type a vehicle number to fetch last-year data (quick fill)</li>
                <li><b>Validation</b>: Hard stops on must-have fields; warnings for minor issues</li>
                <li><b>Dedupe</b>: Same Policy No. blocked; Vehicle+IssueDate warns</li>
              </ul>
            </Card>
          )}
        </Shell>
      ) : (
        <Shell sidebar={<FounderSidebar page={founderPage} setPage={setFounderPage} />}>
          {founderPage === "overview" && <PageOverview/>}
          {founderPage === "kpis" && <PageKPIs/>}
          {founderPage === "leaderboard" && <PageLeaderboard/>}
          {founderPage === "explorer" && <PageExplorer/>}
          {founderPage === "sources" && <PageSources/>}
          {founderPage === "tests" && <PageTests/>}
          {founderPage === "settings" && <PageFounderSettings/>}
        </Shell>
      )}
    </div>
  )
}
