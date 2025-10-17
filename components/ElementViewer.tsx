'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Video, 
  Code, 
  FileText, 
  Monitor, 
  Clock, 
  Image, 
  Music, 
  Map,
  BarChart3,
  Calendar,
  MessageSquare,
  X,
  User,
  Bot,
  Settings,
  Clipboard,
  Calculator,
  Palette,
  Globe,
  Layers,
  Camera,
  Mic
} from 'lucide-react';

export interface ElementType {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  category: string;
  description: string;
}

const elementTypes: ElementType[] = [
  // Media
  { id: 'webcam', name: 'Webcam', icon: Video, category: 'Media', description: 'Live camera feed' },
  { id: 'screenshare', name: 'Screen Share', icon: Monitor, category: 'Media', description: 'Share your screen' },
  { id: 'image', name: 'Image Viewer', icon: Image, category: 'Media', description: 'Upload and display images' },
  { id: 'audio', name: 'Audio Player', icon: Music, category: 'Media', description: 'Play audio files' },
  { id: 'camera', name: 'Photo Capture', icon: Camera, category: 'Media', description: 'Take screenshots' },
  { id: 'microphone', name: 'Voice Recorder', icon: Mic, category: 'Media', description: 'Record audio' },
  
  // Development
  { id: 'code', name: 'Code Editor', icon: Code, category: 'Development', description: 'Code compiler and editor' },
  { id: 'terminal', name: 'Terminal', icon: Monitor, category: 'Development', description: 'Command line interface' },
  { id: 'api', name: 'API Tester', icon: Globe, category: 'Development', description: 'Test REST APIs' },
  
  // Productivity
  { id: 'profile', name: 'Profile Card', icon: User, category: 'Productivity', description: 'User profile information' },
  { id: 'chatbot', name: 'AI Chatbot', icon: Bot, category: 'Productivity', description: 'AI assistant chat' },
  { id: 'notes', name: 'Sticky Notes', icon: Clipboard, category: 'Productivity', description: 'Quick notes and reminders' },
  { id: 'calculator', name: 'Calculator', icon: Calculator, category: 'Productivity', description: 'Basic calculator' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, category: 'Productivity', description: 'Date picker and events' },
  { id: 'clock', name: 'Clock & Timer', icon: Clock, category: 'Productivity', description: 'Time and countdown' },
  
  // Design
  { id: 'colorpicker', name: 'Color Picker', icon: Palette, category: 'Design', description: 'Color selection tool' },
  { id: 'layers', name: 'Layer Panel', icon: Layers, category: 'Design', description: 'Manage design layers' },
  
  // Data & Analytics
  { id: 'chart', name: 'Chart Viewer', icon: BarChart3, category: 'Data', description: 'Data visualization charts' },
  { id: 'dashboard', name: 'Mini Dashboard', icon: Settings, category: 'Data', description: 'Key metrics display' },
  
  // Documents
  { id: 'pptx', name: 'Presentation', icon: FileText, category: 'Documents', description: 'PowerPoint viewer' },
  { id: 'pdf', name: 'PDF Viewer', icon: FileText, category: 'Documents', description: 'View PDF documents' },
  
  // Communication
  { id: 'chat', name: 'Chat Widget', icon: MessageSquare, category: 'Communication', description: 'Team chat interface' },
  
  // Utilities
  { id: 'map', name: 'Map Viewer', icon: Map, category: 'Utilities', description: 'Interactive maps' },
  { id: 'weather', name: 'Weather Widget', icon: Globe, category: 'Utilities', description: 'Current weather info' },
];

interface ElementViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onElementSelect: (elementType: string) => void;
  isDarkMode: boolean;
}

export function ElementViewer({ isOpen, onClose, onElementSelect, isDarkMode }: ElementViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(elementTypes.map(el => el.category)))];

  const filteredElements = elementTypes.filter(element => {
    const matchesSearch = element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         element.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || element.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sidebar */}
      <div className={`relative w-80 h-full shadow-2xl ${
        isDarkMode ? 'bg-gray-900 border-r border-gray-700' : 'bg-white border-r border-gray-200'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Add Elements
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-white' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`} size={16} />
            <input
              type="text"
              placeholder="Search elements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white shadow-md'
                    : isDarkMode
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Elements Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {filteredElements.map((element) => {
              const IconComponent = element.icon;
              return (
                <button
                  key={element.id}
                  onClick={() => onElementSelect(element.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                      : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-gray-300'
                  }`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'element',
                      elementType: element.id,
                      name: element.name
                    }));
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-700' : 'bg-white'
                    } shadow-sm`}>
                      <IconComponent 
                        size={24} 
                        className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} 
                      />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {element.name}
                      </div>
                      <div className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {element.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {filteredElements.length === 0 && (
            <div className={`text-center py-8 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Search size={48} className="mx-auto mb-4 opacity-50" />
              <p>No elements found</p>
              <p className="text-sm mt-1">Try adjusting your search or category filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <p className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            💡 Tip: Drag elements directly onto the canvas or click to add them
          </p>
        </div>
      </div>
    </div>
  );
}