'use client';

import React, { useState } from 'react';
import { Send, MessageSquare, User, Building2, GraduationCap, Shield } from 'lucide-react';
import { UserRole } from '@/types/database';

export interface MessageItem {
  id: string;
  senderName: string;
  senderRole: UserRole;
  senderOrg?: string;
  content: string;
  timestamp: string;
  isSelf?: boolean;
}

interface MessageThreadProps {
  challengeRef: string;
  projectTitle: string;
  messages: MessageItem[];
  onSendMessage: (text: string) => Promise<void> | void;
  currentUserRole?: UserRole;
}

const DEFAULT_THREAD: MessageItem[] = [
  {
    id: 'm-1',
    senderName: 'Dr. A. Verma',
    senderRole: 'university',
    senderOrg: 'BIT Mesra ECE Lab',
    content: 'We have assembled the first 4 solar relay boards in the lab. Testing with Damini simulated CAP triggers was successful. Ready to receive the 800kg steel structural casings.',
    timestamp: '2 days ago',
  },
  {
    id: 'm-2',
    senderName: 'R. S. Murthy',
    senderRole: 'industry',
    senderOrg: 'Tata Steel CSR',
    content: 'Dispatch #44-GUM from our Ranchi stockyard was approved. 800kg steel poles and weatherproof NEMA enclosures scheduled for truck delivery tomorrow morning.',
    timestamp: 'Yesterday at 3:15 PM',
  },
  {
    id: 'm-3',
    senderName: 'Sunil Toppo',
    senderRole: 'volunteer',
    senderOrg: 'Aapda Mitra Gumla',
    content: 'Sisai and Bharno panchayat halls have cleared rooftop access for the siren masts. Village mukhiyas have been informed.',
    timestamp: 'Today at 10:45 AM',
  },
];

export function MessageThread({
  challengeRef,
  projectTitle,
  messages = DEFAULT_THREAD,
  onSendMessage,
  currentUserRole = 'university',
}: MessageThreadProps) {
  const [thread, setThread] = useState<MessageItem[]>(messages);
  const [newText, setNewText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(newText.trim());

      const newMsg: MessageItem = {
        id: `msg-${Date.now()}`,
        senderName: currentUserRole === 'university' ? 'BIT Mesra Team' : currentUserRole === 'industry' ? 'Tata Steel CSR' : 'District Officer',
        senderRole: currentUserRole,
        senderOrg: currentUserRole === 'university' ? 'Lead University' : 'Corporate Partner',
        content: newText.trim(),
        timestamp: 'Just now',
        isSelf: true,
      };

      setThread((prev) => [...prev, newMsg]);
      setNewText('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'university': return <GraduationCap className="w-3.5 h-3.5 text-blue-600" />;
      case 'industry': return <Building2 className="w-3.5 h-3.5 text-purple-600" />;
      case 'coordinator': case 'admin': return <Shield className="w-3.5 h-3.5 text-amber-600" />;
      default: return <User className="w-3.5 h-3.5 text-teal-600" />;
    }
  };

  return (
    <div className="bg-white border border-[#CCD1C7] rounded-xl flex flex-col h-[460px] shadow-xs overflow-hidden">
      {/* Thread Header */}
      <div className="px-4 py-3 bg-[#F4F6F5] border-b border-[#CCD1C7] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#2E7180]" />
          <div>
            <h4 className="text-xs font-bold font-mono text-[#102027]">
              Project Communications · {challengeRef}
            </h4>
            <p className="text-[11px] text-gray-500 truncate max-w-xs sm:max-w-md">{projectTitle}</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-[#CCD1C7]">
          End-to-End Logged
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {thread.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="p-0.5 bg-white rounded shadow-2xs">
                {getRoleIcon(msg.senderRole)}
              </span>
              <span className="text-[11px] font-bold text-[#102027]">{msg.senderName}</span>
              {msg.senderOrg && (
                <span className="text-[10px] text-gray-500 font-mono">({msg.senderOrg})</span>
              )}
              <span className="text-[10px] text-gray-400 font-mono">· {msg.timestamp}</span>
            </div>

            <div
              className={`p-3 rounded-xl text-xs leading-relaxed ${
                msg.isSelf
                  ? 'bg-[#2E7180] text-white rounded-tr-none'
                  : 'bg-white text-[#102027] border border-[#CCD1C7] rounded-tl-none shadow-2xs'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-[#CCD1C7] flex items-center gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Type update or coordination note to partners..."
          disabled={isSending}
          className="flex-1 text-xs px-3.5 py-2 rounded-lg border border-[#CCD1C7] outline-none focus:border-[#2E7180] focus:ring-1 focus:ring-[#2E7180]"
        />
        <button
          type="submit"
          disabled={isSending || !newText.trim()}
          className="touch-target px-3.5 py-2 bg-[#2E7180] hover:bg-[#245A66] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
