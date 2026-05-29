import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import DocumentUpload from './components/DocumentUpload';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {activeTab === 'chat' ? (
          <ChatInterface />
        ) : (
          <DocumentUpload />
        )}
      </main>
    </div>
  );
}
