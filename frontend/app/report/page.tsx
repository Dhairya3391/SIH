'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Mic, 
  MapPin, 
  Camera, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Users,
  ShieldAlert
} from 'lucide-react';
import { submitReport } from '@/lib/api';

export default function ReportPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [district, setDistrict] = useState('Gumla');
  const [village, setVillage] = useState('Sisai Block');
  const [peopleEst, setPeopleEst] = useState('100');
  const [isRecording, setIsRecording] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const sampleHindiVoiceNotes = [
    'खेत में काम करते समय बिजली गिरने से दो लोग घायल हो गए। यहाँ कोई शेल्टर नहीं है।',
    'गंगा नदी का पानी गांव में घुस गया है। 2 दिन से पीने का पानी नहीं है और पुल टूट गया है।',
    'हमारे गांव के स्कूल के पास का नाला बह गया है। 200 बच्चे स्कूल नहीं जा पा रहे।'
  ];

  const handleSimulateVoice = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      const randomNote = sampleHindiVoiceNotes[Math.floor(Math.random() * sampleHindiVoiceNotes.length)];
      setText(randomNote);
    }, 1500);
  };

  const handleGetLocation = () => {
    setLocationStatus('Getting GPS...');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setLocationStatus('GPS: Gumla Sadar (Offline Fallback)');
        }
      );
    } else {
      setLocationStatus('GPS: 22.9904, 84.5450 (Gumla)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErrorMessage('Please describe the problem or record a voice note');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await submitReport({
        text,
        district,
        village,
        people_est: parseInt(peopleEst, 10) || 100,
      });

      setResult(res);
      setTimeout(() => {
        router.push('/queue');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-[#CCD1C7] px-4 py-3 sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#102027]">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7180] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#2E7180]">JharSetu Citizen Link</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full p-4 flex-1">
        <div className="bg-white rounded-2xl border border-[#CCD1C7] p-5 sm:p-7 shadow-xs">
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#2E7180]/10 text-[#2E7180] mb-2 border border-[#2E7180]/20">
              <ShieldAlert className="w-3.5 h-3.5" /> Rapid Problem Intake
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Report a Local Need</h1>
            <p className="text-xs text-gray-500 mt-1">
              Speak in Hindi or type. Works on any phone, with or without high-speed internet.
            </p>
          </div>

          {result ? (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-center animate-fade-in">
              <CheckCircle2 className="w-10 h-10 text-[#3E8064] mx-auto mb-2" />
              <h3 className="font-bold text-sm text-[#102027]">Report Submitted & Compiled!</h3>
              <p className="text-xs text-gray-600 mt-1">
                {result.compiled?.category} · priority{' '}
                <strong>{result.compiled?.priority}</strong>
                {result.challenge_ref ? <> · <span className="font-mono">{result.challenge_ref}</span></> : null}
              </p>
              {result.dedup_reason && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  {result.dedup_reason}
                </p>
              )}
              {Array.isArray(result.trace) && result.trace.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.trace.map((t: { step: string; label: string; ms: number; usedAi: boolean }) => (
                    <span
                      key={t.step}
                      title={t.label}
                      className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[10px] text-gray-600"
                    >
                      {t.label} {t.ms}ms{t.usedAi ? ' · ai' : ''}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs font-mono text-[#2E7180] mt-2">
                Redirecting to Coordinator Queue in 2s...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Voice Note Button */}
              <div className="bg-[#F4F6F5] p-3.5 rounded-xl border border-[#CCD1C7] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-[#102027]">Voice Note (Hindi / Nagpuri)</div>
                  <div className="text-gray-500 text-[11px]">Tap to speak without typing</div>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateVoice}
                  disabled={isRecording}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    isRecording 
                      ? 'bg-[#D94F45] text-white animate-pulse' 
                      : 'bg-[#2E7180] hover:bg-[#245A66] text-white shadow-xs'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  {isRecording ? 'Listening...' : 'Record Voice Note'}
                </button>
              </div>

              {/* Text Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Describe what happened <span className="text-[#D94F45]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="उदा. खेत में बिजली गिरने से 2 लोग मर गए, शेल्टर नहीं है... (Describe problem in any language)"
                  className="w-full text-sm p-3 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] focus:border-[#2E7180] outline-none transition"
                />
              </div>

              {/* District & Village Block */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">District</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] font-semibold outline-none"
                  >
                    <option value="Gumla">Gumla</option>
                    <option value="Sahebganj">Sahebganj</option>
                    <option value="Dhanbad">Dhanbad</option>
                    <option value="Palamu">Palamu</option>
                    <option value="Ranchi">Ranchi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Village / Block</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Sisai Block"
                    className="w-full text-xs p-2.5 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] outline-none"
                  />
                </div>
              </div>

              {/* People Affected & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    People Affected
                  </label>
                  <div className="relative">
                    <Users className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      value={peopleEst}
                      onChange={(e) => setPeopleEst(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Location</label>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    className="w-full text-xs py-2.5 px-3 rounded-xl border border-[#CCD1C7] bg-[#F4F6F5] hover:bg-gray-200 flex items-center justify-center gap-1.5 font-semibold text-gray-700 transition truncate"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                    {locationStatus || 'Use My GPS'}
                  </button>
                </div>
              </div>

              {/* Photo attachment mock */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => alert('Camera/file input ready. Photos are stripped of EXIF PII before public display.')}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-[#CCD1C7] text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 font-medium"
                >
                  <Camera className="w-4 h-4 text-gray-500" />
                  Attach Ground Photo (Optional)
                </button>
              </div>

              {errorMessage && (
                <div className="text-xs text-[#A8332A] flex items-center gap-1 p-2 bg-red-50 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#2E7180] hover:bg-[#245A66] text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting & Compiling Brief...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Report
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
