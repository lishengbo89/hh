/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  ScrollText, 
  Users, 
  Calendar, 
  Package, 
  Handshake, 
  MessageSquare,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { STEPS, UserProgress } from './types';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('village-guidance-progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          maxStepReached: parsed.maxStepReached || parsed.currentStep || 1
        };
      } catch (e) {
        console.error("Failed to parse saved progress", e);
      }
    }
    return {
      currentStep: 1,
      maxStepReached: 1,
      theme: { keyword: '', description: '' },
      practitioners: [''],
      activities: [''],
      products: [''],
      coCreation: {},
      isAlternativePathActive: new Array(STEPS.length).fill(false)
    };
  });

  useEffect(() => {
    localStorage.setItem('village-guidance-progress', JSON.stringify(progress));
  }, [progress]);

  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for back
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    
    setIsGeneratingImage(true);
    setShowSaveOptions(false);
    
    try {
      // Small delay to ensure any UI transitions are finished
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node.classList && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        },
        style: {
          borderRadius: '0',
          boxShadow: 'none',
          border: 'none'
        }
      });
      
      const link = document.createElement('a');
      link.download = `社群生态梳理报告-${progress.theme.keyword || '未命名'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadPDF = () => {
    setShowSaveOptions(false);
    window.print();
  };

  const currentStepData = STEPS[progress.currentStep - 1];

  const formatKeyword = (kw: string) => {
    if (!kw) return '';
    return kw.startsWith('#') ? kw : `#${kw}`;
  };

  const getDynamicText = (text: string, stripEllipsis: boolean = false): React.ReactNode => {
    if (!text) return text;
    let substituted = text;
    if (stripEllipsis) {
      substituted = substituted.replace(/\.\.\./g, '').replace(/。/g, '');
    }
    
    const keyword = progress.theme.keyword ? formatKeyword(progress.theme.keyword) : '';
    if (keyword) {
      substituted = substituted.replace(/这个主题/g, keyword).replace(/主题相关/g, `${keyword}相关`);
    }

    const validHighlights = keyword ? [keyword] : [];
    if (validHighlights.length === 0) return substituted;

    const escapedHighlights = validHighlights.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedHighlights.join('|')})`, 'g');
    
    const parts = substituted.split(regex);
    if (parts.length === 1) return substituted;

    return (
      <>
        {parts.map((part, i) => {
          if (validHighlights.includes(part)) {
            return (
              <span key={i} className="text-[#5a5a40] font-bold bg-[#5a5a40]/10 px-1.5 py-0.5 rounded-md mx-0.5 inline-block transform -rotate-1">
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  const getStepSummary = (stepId: number) => {
    switch (stepId) {
      case 1:
        return progress.theme.keyword ? formatKeyword(progress.theme.keyword) : '';
      case 2:
        const count = progress.practitioners.filter(p => p.trim()).length;
        return count > 0 ? `${count} 位实践者` : '';
      case 3:
        const activityCount = progress.activities.filter(a => a.trim()).length;
        return activityCount > 0 ? `${activityCount} 个环节` : '';
      case 4:
        const productCount = progress.products.filter(p => p.trim()).length;
        return productCount > 0 ? `${productCount} 个产品` : '';
      case 5:
        const coCount = (Object.values(progress.coCreation) as string[]).filter(v => v.trim()).length;
        return coCount > 0 ? `${coCount} 个共创` : '';
      default:
        return '';
    }
  };

  const [showReport, setShowReport] = useState(() => {
    return localStorage.getItem('village-guidance-show-report') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('village-guidance-show-report', showReport.toString());
  }, [showReport]);

  const isStepValid = () => {
    switch (progress.currentStep) {
      case 1:
        return progress.theme.keyword.trim() !== '' && progress.theme.description.trim() !== '';
      case 2:
        return progress.practitioners.some(p => p.trim() !== '');
      case 3:
        return progress.activities.some(a => a.trim() !== '');
      case 4:
        return progress.products.some(p => p.trim() !== '');
      case 5:
        return (Object.values(progress.coCreation) as string[]).some(v => v.trim() !== '');
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    
    setDirection(1);
    setAiFeedback('');
    
    if (progress.currentStep < STEPS.length) {
      const nextStep = progress.currentStep + 1;
      setProgress(prev => ({ 
        ...prev, 
        currentStep: nextStep,
        maxStepReached: Math.max(prev.maxStepReached, nextStep)
      }));
    } else {
      setShowReport(true);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    setAiFeedback('');
    
    if (showReport) {
      setShowReport(false);
      return;
    }
    if (progress.currentStep > 1) {
      setProgress(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const goToStep = (stepId: number) => {
    if (stepId === progress.currentStep && !showReport) return;
    
    // Allow jumping to any step that has been reached/unlocked
    // or any step if the report is already showing
    const canJump = showReport || stepId <= progress.maxStepReached;
    
    if (canJump) {
      setDirection(stepId > progress.currentStep ? 1 : -1);
      setAiFeedback('');
      setShowReport(false);
      setProgress(prev => ({ ...prev, currentStep: stepId }));
    }
  };

  const toggleAlternative = (index: number) => {
    const newPaths = [...progress.isAlternativePathActive];
    newPaths[index] = !newPaths[index];
    setProgress(prev => ({ ...prev, isAlternativePathActive: newPaths }));
  };

  const getElderAdvice = useCallback(async () => {
    setIsTyping(true);
    try {
      const stepTitle = showReport ? "生成报告" : currentStepData.title;
      const prompt = `你是一位智慧的社群运营老爷爷，正在指导一位新手。
      当前状态：${stepTitle}
      用户输入的内容：${JSON.stringify(progress)}
      请根据用户的输入，给出一段简短、温暖、有洞察力的鼓励或建议（100字以内）。
      如果是最后生成报告阶段，请给出一个总结性的寄语。`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiFeedback(response.text || "孩子，慢慢来，每一步都算数。");
    } catch (error) {
      console.error("Gemini Error:", error);
      setAiFeedback("哎呀，老头子我刚才走神了。不过没关系，按照你的直觉去做吧。");
    } finally {
      setIsTyping(false);
    }
  }, [showReport, currentStepData, progress]);

  useEffect(() => {
    // Automatically trigger advice when moving forward to a new step or report
    if (direction === 1 && (progress.currentStep > 1 || showReport)) {
      getElderAdvice();
    }
  }, [progress.currentStep, showReport, direction, getElderAdvice]);

  const updatePractitioner = (index: number, value: string) => {
    const newPractitioners = [...progress.practitioners];
    newPractitioners[index] = value;
    setProgress(prev => ({ ...prev, practitioners: newPractitioners }));
  };

  const addPractitioner = () => {
    setProgress(prev => ({ ...prev, practitioners: [...prev.practitioners, ''] }));
  };

  const removePractitioner = (index: number) => {
    if (progress.practitioners.length > 1) {
      const newPractitioners = progress.practitioners.filter((_, i) => i !== index);
      setProgress(prev => ({ ...prev, practitioners: newPractitioners }));
    } else {
      setProgress(prev => ({ ...prev, practitioners: [''] }));
    }
  };

  const updateActivity = (index: number, value: string) => {
    const newActivities = [...progress.activities];
    newActivities[index] = value;
    setProgress(prev => ({ ...prev, activities: newActivities }));
  };

  const addActivity = () => {
    setProgress(prev => ({ ...prev, activities: [...prev.activities, ''] }));
  };

  const removeActivity = (index: number) => {
    if (progress.activities.length > 1) {
      const newActivities = progress.activities.filter((_, i) => i !== index);
      setProgress(prev => ({ ...prev, activities: newActivities }));
    } else {
      setProgress(prev => ({ ...prev, activities: [''] }));
    }
  };

  const updateProduct = (index: number, value: string) => {
    const newProducts = [...progress.products];
    newProducts[index] = value;
    setProgress(prev => ({ ...prev, products: newProducts }));
  };

  const addProduct = () => {
    setProgress(prev => ({ ...prev, products: [...prev.products, ''] }));
  };

  const removeProduct = (index: number) => {
    if (progress.products.length > 1) {
      const newProducts = progress.products.filter((_, i) => i !== index);
      setProgress(prev => ({ ...prev, products: newProducts }));
    } else {
      setProgress(prev => ({ ...prev, products: [''] }));
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
      scale: 0.95,
      rotateY: direction > 0 ? 15 : -15,
      filter: 'blur(10px)',
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      filter: 'blur(0px)',
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 200 : -200,
      opacity: 0,
      scale: 1.05,
      rotateY: direction < 0 ? 15 : -15,
      filter: 'blur(10px)',
    })
  };

  const renderStepIcon = (id: number) => {
    switch (id) {
      case 1: return <ScrollText className="w-5 h-5" />;
      case 2: return <Users className="w-5 h-5" />;
      case 3: return <Calendar className="w-5 h-5" />;
      case 4: return <Package className="w-5 h-5" />;
      case 5: return <Handshake className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f5f0] text-[#4a4a40] font-serif overflow-hidden perspective-[2000px]">
      {/* Left Sidebar: Elder & Pulse */}
      <aside className="w-[380px] bg-white border-r border-[#5a5a40]/10 flex flex-col shadow-2xl z-10">
        {/* Elder Section */}
        <div className="p-8 border-bottom border-[#5a5a40]/5 bg-[#fcfcf9]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-[#5a5a40] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5a5a40]/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#2a2a20]">社群新手村</h1>
              <p className="text-xs opacity-50 font-sans uppercase tracking-widest">Village Guidance</p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              boxShadow: [
                "0 4px 6px -1px rgba(90, 90, 64, 0.05), 0 2px 4px -1px rgba(90, 90, 64, 0.03)",
                "0 10px 15px -3px rgba(90, 90, 64, 0.1), 0 4px 6px -2px rgba(90, 90, 64, 0.05)",
                "0 4px 6px -1px rgba(90, 90, 64, 0.05), 0 2px 4px -1px rgba(90, 90, 64, 0.03)"
              ]
            }}
            transition={{
              opacity: { duration: 0.5 },
              y: { duration: 0.5 },
              boxShadow: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            whileHover={{ scale: 1.02 }}
            className="bg-[#f5f5f0] rounded-[24px] p-6 relative transition-all border border-[#5a5a40]/10"
          >
            <div className="flex items-start gap-4">
              <motion.div 
                animate={{ 
                  y: [0, -12, 0],
                  scale: [1, 1.15, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="text-4xl shrink-0 cursor-default select-none drop-shadow-md"
              >
                👴
              </motion.div>
              <div className="space-y-3 flex-grow">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">村口老爷爷</p>
                  {!isTyping && !aiFeedback && (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 bg-[#5a5a40] rounded-full"
                    />
                  )}
                </div>
                <div className="text-xs leading-relaxed italic text-[#6a6a50] min-h-[80px]">
                  {isTyping ? (
                    <div className="flex gap-1 pt-2">
                      <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }}>.</motion.span>
                      <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>.</motion.span>
                      <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>.</motion.span>
                    </div>
                  ) : (
                    aiFeedback || "孩子，欢迎来到社群新手村。我是这里的向导，我会陪你一步步建立起属于你的主题生态。"
                  )}
                </div>
                <motion.button 
                  onClick={getElderAdvice}
                  disabled={isTyping}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5a5a40] hover:opacity-70 transition-opacity pt-2 border-t border-[#5a5a40]/10 w-full group"
                >
                  <RefreshCw className={`w-3 h-3 ${isTyping ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                  听听老爷爷的建议
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Pulse (Steps) Section */}
        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-8 ml-2">社群脉络 / Steps</h3>
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-[#5a5a40]/10" />
            
            <div className="space-y-6">
              {STEPS.map((step, idx) => {
                const isActive = progress.currentStep === step.id && !showReport;
                const isReached = progress.maxStepReached >= step.id || showReport;
                const isCompleted = isReached && !isActive && (progress.currentStep > step.id || showReport || progress.maxStepReached > step.id);
                const summary = getStepSummary(step.id);
                const canClick = isReached;
                
                return (
                  <div 
                    key={step.id}
                    onClick={() => goToStep(step.id)}
                    className={`relative flex items-start gap-6 transition-all duration-500 group/step ${
                      isActive ? 'scale-105' : isReached ? 'opacity-100' : 'opacity-40 grayscale'
                    } ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isActive ? 'bg-[#5a5a40] text-white shadow-lg shadow-[#5a5a40]/30' : 
                      isCompleted ? 'bg-[#5a5a40] text-white' : 'bg-white border-2 border-[#5a5a40]/10 text-[#5a5a40]'
                    } ${canClick ? 'group-hover/step:scale-110' : ''}`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : renderStepIcon(step.id)}
                    </div>
                    
                    <div className="pt-1 flex-grow">
                      <p className={`text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-[#2a2a20]' : canClick ? 'group-hover/step:text-[#5a5a40]' : ''}`}>
                        {step.title.split('：')[0]}
                      </p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className={`text-sm font-medium transition-colors ${isActive ? 'text-[#5a5a40]' : canClick ? 'group-hover/step:text-[#2a2a20]' : ''}`}>
                          {step.title.split('：')[1]}
                        </p>
                        {summary && (
                          <motion.span 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[10px] px-2 py-0.5 bg-[#5a5a40]/10 text-[#5a5a40] rounded-full font-sans font-bold"
                          >
                            {summary}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Report Step in Sidebar */}
              <div 
                onClick={() => {
                  if (showReport) return;
                  // Allow jumping to report if we've reached the end and current step is valid
                  if (isStepValid() && progress.maxStepReached >= STEPS.length) {
                    setShowReport(true);
                    setDirection(1);
                    setAiFeedback('');
                  }
                }}
                className={`relative flex items-start gap-6 transition-all duration-500 group/report ${showReport ? 'scale-105 opacity-100' : 'opacity-40 grayscale'} ${isStepValid() && progress.maxStepReached >= STEPS.length ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  showReport ? 'bg-[#5a5a40] text-white shadow-lg shadow-[#5a5a40]/30' : 'bg-white border-2 border-[#5a5a40]/10 text-[#5a5a40]'
                } ${isStepValid() && progress.maxStepReached >= STEPS.length ? 'group-hover/report:scale-110' : ''}`}>
                  <ScrollText className="w-5 h-5" />
                </div>
                <div className="pt-1">
                  <p className={`text-xs font-bold uppercase tracking-wider transition-colors ${showReport ? 'text-[#2a2a20]' : (isStepValid() && progress.maxStepReached >= STEPS.length) ? 'group-hover/report:text-[#5a5a40]' : ''}`}>Final</p>
                  <p className={`text-sm font-medium transition-colors ${showReport ? 'text-[#5a5a40]' : (isStepValid() && progress.maxStepReached >= STEPS.length) ? 'group-hover/report:text-[#2a2a20]' : ''}`}>梳理报告</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Main: Interaction Workspace */}
      <main className="flex-grow relative overflow-hidden bg-[#fcfcf9]">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-12 py-20 min-h-full flex flex-col">
            <AnimatePresence mode="wait" custom={direction}>
              {!showReport ? (
                <motion.div
                  key={progress.currentStep}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.4 },
                    rotateY: { duration: 0.6 },
                    filter: { duration: 0.4 }
                  }}
                  className="flex-grow flex flex-col"
                >
                  <header className="mb-12">
                    <div className="inline-block px-4 py-1 bg-[#5a5a40]/5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a5a40] mb-6">
                      {getDynamicText(currentStepData.title)}
                    </div>
                    <h2 className="text-5xl font-bold text-[#2a2a20] leading-tight mb-6">
                      {getDynamicText(currentStepData.description)}
                    </h2>
                    <div className="h-1 w-20 bg-[#5a5a40]/20 rounded-full" />
                  </header>

                  <div className="space-y-10 flex-grow">
                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-1">
                        {getDynamicText(currentStepData.inputLabel)}
                      </label>
                      
                      {progress.currentStep === 1 ? (
                        <div className="grid gap-6">
                          <input 
                            type="text"
                            placeholder="关键词，例如：#数字游民"
                            className="w-full text-2xl p-6 rounded-[24px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans placeholder:opacity-30"
                            value={progress.theme.keyword}
                            onChange={(e) => setProgress(prev => ({ ...prev, theme: { ...prev.theme, keyword: e.target.value } }))}
                          />
                          <textarea 
                            placeholder="描述你对这个主题的理解以及它的意义和价值"
                            className="w-full text-lg p-6 rounded-[24px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans min-h-[160px] placeholder:opacity-30 leading-relaxed"
                            value={progress.theme.description}
                            onChange={(e) => setProgress(prev => ({ ...prev, theme: { ...prev.theme, description: e.target.value } }))}
                          />
                        </div>
                      ) : progress.currentStep === 2 ? (
                        <div className="space-y-4">
                          {progress.practitioners.map((p, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3"
                            >
                              <input 
                                type="text"
                                placeholder={`实践者 ${index + 1}`}
                                className="flex-grow text-lg p-5 rounded-[20px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans"
                                value={p}
                                onChange={(e) => updatePractitioner(index, e.target.value)}
                              />
                              <button 
                                onClick={() => removePractitioner(index)}
                                className="w-14 h-14 rounded-[20px] flex items-center justify-center text-[#5a5a40] hover:bg-red-50 hover:text-red-500 transition-colors border border-[#5a5a40]/10"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </motion.div>
                          ))}
                          <button 
                            onClick={addPractitioner}
                            className="w-full p-5 rounded-[20px] border-2 border-dashed border-[#5a5a40]/20 text-[#5a5a40] flex items-center justify-center gap-2 hover:bg-[#5a5a40]/5 transition-all font-bold"
                          >
                            <Plus className="w-5 h-5" />
                            添加下一位实践者
                          </button>
                        </div>
                      ) : progress.currentStep === 3 ? (
                        <div className="space-y-4">
                          {progress.activities.map((a, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3"
                            >
                              <div className="flex-grow relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">环节 {index + 1}</span>
                                <input 
                                  type="text"
                                  placeholder={index === 0 ? "例如：自我介绍与破冰" : "描述下一个环节..."}
                                  className="w-full text-lg p-5 pl-16 rounded-[20px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans"
                                  value={a}
                                  onChange={(e) => updateActivity(index, e.target.value)}
                                />
                              </div>
                              <button 
                                onClick={() => removeActivity(index)}
                                className="w-14 h-14 rounded-[20px] flex items-center justify-center text-[#5a5a40] hover:bg-red-50 hover:text-red-500 transition-colors border border-[#5a5a40]/10"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </motion.div>
                          ))}
                          <button 
                            onClick={addActivity}
                            className="w-full p-5 rounded-[20px] border-2 border-dashed border-[#5a5a40]/20 text-[#5a5a40] flex items-center justify-center gap-2 hover:bg-[#5a5a40]/5 transition-all font-bold"
                          >
                            <Plus className="w-5 h-5" />
                            添加下一个环节
                          </button>
                        </div>
                      ) : progress.currentStep === 4 ? (
                        <div className="space-y-4">
                          {progress.products.map((p, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3"
                            >
                              <input 
                                type="text"
                                placeholder={`产品 ${index + 1}`}
                                className="flex-grow text-lg p-5 rounded-[20px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans"
                                value={p}
                                onChange={(e) => updateProduct(index, e.target.value)}
                              />
                              <button 
                                onClick={() => removeProduct(index)}
                                className="w-14 h-14 rounded-[20px] flex items-center justify-center text-[#5a5a40] hover:bg-red-50 hover:text-red-500 transition-colors border border-[#5a5a40]/10"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </motion.div>
                          ))}
                          <button 
                            onClick={addProduct}
                            className="w-full p-5 rounded-[20px] border-2 border-dashed border-[#5a5a40]/20 text-[#5a5a40] flex items-center justify-center gap-2 hover:bg-[#5a5a40]/5 transition-all font-bold"
                          >
                            <Plus className="w-5 h-5" />
                            添加下一个产品
                          </button>
                        </div>
                      ) : progress.currentStep === 5 ? (
                        <div className="space-y-4">
                          {progress.practitioners.filter(p => p.trim()).map((practitioner, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-4 bg-white p-6 rounded-[24px] border border-[#5a5a40]/10 shadow-sm"
                            >
                              <div className="flex-grow flex items-center gap-3 text-lg">
                                <span className="font-bold text-[#5a5a40]">{formatKeyword(progress.theme.keyword)}</span>
                                <span className="text-[#5a5a40]/40">✖️</span>
                                <span className="font-bold text-[#5a5a40]">{practitioner}</span>
                                <span className="text-[#5a5a40]/40">=</span>
                                <input 
                                  type="text"
                                  placeholder="共创行动"
                                  className="flex-grow bg-transparent border-b border-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none px-2 py-1 placeholder:opacity-30"
                                  value={progress.coCreation[practitioner] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProgress(prev => ({
                                      ...prev,
                                      coCreation: {
                                        ...prev.coCreation,
                                        [practitioner]: val
                                      }
                                    }));
                                  }}
                                />
                              </div>
                            </motion.div>
                          ))}
                          {progress.practitioners.filter(p => p.trim()).length === 0 && (
                            <div className="text-center p-12 bg-white/50 rounded-[32px] border-2 border-dashed border-[#5a5a40]/10 italic opacity-50">
                              请先在第二步添加实践者
                            </div>
                          )}
                        </div>
                      ) : (
                        <textarea 
                          placeholder={currentStepData.placeholder}
                          className="w-full text-lg p-8 rounded-[32px] bg-white border border-[#5a5a40]/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 transition-all font-sans min-h-[300px] placeholder:opacity-30 leading-relaxed"
                          value={typeof progress.activities === 'string' ? progress.activities : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProgress(prev => ({ ...prev, activities: val as any }));
                          }}
                        />
                      )}
                    </div>

                    {/* Alternative Path Section */}
                    <div 
                      onClick={() => toggleAlternative(progress.currentStep - 1)}
                      className="bg-[#f5f5f0] rounded-[32px] p-8 border border-[#5a5a40]/5 cursor-pointer hover:bg-[#5a5a40]/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 text-sm font-bold text-[#5a5a40]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${progress.isAlternativePathActive[progress.currentStep - 1] ? 'bg-[#5a5a40] text-white' : 'bg-white border border-[#5a5a40]/20'}`}>
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <span className="group-hover:underline decoration-dotted underline-offset-4">
                          {getDynamicText(currentStepData.alternativePath.condition)}
                        </span>
                      </div>
                    </div>

                    {/* Modal Popup */}
                    <AnimatePresence>
                      {progress.isAlternativePathActive[progress.currentStep - 1] && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => toggleAlternative(progress.currentStep - 1)}
                            className="absolute inset-0 bg-[#2a2a20]/40 backdrop-blur-sm"
                          />
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg bg-white rounded-[40px] p-10 shadow-2xl border border-[#5a5a40]/10 overflow-hidden"
                          >
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#5a5a40]/5 rounded-bl-[100px] -mr-10 -mt-10" />
                            
                            <button 
                              onClick={() => toggleAlternative(progress.currentStep - 1)}
                              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[#f5f5f0] flex items-center justify-center text-[#5a5a40] hover:bg-[#5a5a40] hover:text-white transition-all z-10"
                            >
                              <X className="w-5 h-5" />
                            </button>

                            <div className="relative z-10">
                              <div className="w-16 h-16 bg-[#5a5a40]/10 rounded-3xl flex items-center justify-center mb-8">
                                <HelpCircle className="w-8 h-8 text-[#5a5a40]" />
                              </div>
                              
                              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#5a5a40] mb-4 opacity-40">
                                智慧指引 / Guidance
                              </h3>
                              
                              <p className="text-2xl font-bold text-[#2a2a20] leading-tight mb-8">
                                {getDynamicText(currentStepData.alternativePath.condition, true)}
                              </p>

                              <div className="p-8 bg-[#fcfcf9] rounded-3xl border-l-4 border-[#5a5a40] shadow-inner">
                                <p className="text-lg leading-relaxed italic text-[#5a5a40]">
                                  “{getDynamicText(currentStepData.alternativePath.suggestion)}”
                                </p>
                              </div>

                              {progress.currentStep === 1 ? (
                                <a 
                                  href="https://gwpjjamu2g.feishu.cn/base/AOEIbirG2awfnzs7P21c2SS5n8f?table=tblD4JdDwee3Vce6&view=vewCVByMRl"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => toggleAlternative(progress.currentStep - 1)}
                                  className="block w-full mt-10 py-4 bg-[#5a5a40] text-white rounded-full font-bold shadow-lg shadow-[#5a5a40]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
                                >
                                  点击了解不同的主题社群
                                </a>
                              ) : progress.currentStep === 3 ? (
                                <a 
                                  href="https://mp.weixin.qq.com/s/E_p90cQot5im1S27_u2E-g"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => toggleAlternative(progress.currentStep - 1)}
                                  className="block w-full mt-10 py-4 bg-[#5a5a40] text-white rounded-full font-bold shadow-lg shadow-[#5a5a40]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
                                >
                                  点击了解【朋友的朋友局】
                                </a>
                              ) : progress.currentStep === 5 ? (
                                <a 
                                  href="https://mp.weixin.qq.com/s/oy5sKQdlO0H0PlypoKZFdA"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => toggleAlternative(progress.currentStep - 1)}
                                  className="block w-full mt-10 py-4 bg-[#5a5a40] text-white rounded-full font-bold shadow-lg shadow-[#5a5a40]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
                                >
                                  点击了解【行动者网络】
                                </a>
                              ) : (
                                <button 
                                  onClick={() => toggleAlternative(progress.currentStep - 1)}
                                  className="w-full mt-10 py-4 bg-[#5a5a40] text-white rounded-full font-bold shadow-lg shadow-[#5a5a40]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                  我明白了
                                </button>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Navigation Footer */}
                  <footer className="mt-auto pt-20 flex items-center justify-between pb-12">
                    <button 
                      onClick={handleBack}
                      disabled={progress.currentStep === 1}
                      className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all ${
                        progress.currentStep === 1 ? 'opacity-0 pointer-events-none' : 'hover:bg-[#5a5a40]/5 text-[#5a5a40]'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                      上一步
                    </button>
                    
                    <div className="flex flex-col items-end gap-2">
                      {!isStepValid() && (
                        <span className="text-[10px] font-bold text-[#5a5a40]/40 uppercase tracking-widest animate-pulse mr-4">
                          请先填写内容以继续
                        </span>
                      )}
                      <button 
                        onClick={handleNext}
                        disabled={!isStepValid()}
                        className={`flex items-center gap-3 px-10 py-4 rounded-full font-bold shadow-xl transition-all ${
                          isStepValid() 
                            ? 'bg-[#5a5a40] text-white shadow-[#5a5a40]/20 hover:scale-[1.02] active:scale-[0.98]' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {progress.currentStep === STEPS.length ? '生成报告' : '下一步'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </footer>
                </motion.div>
              ) : (
                <motion.div
                  key="report"
                  ref={reportRef}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-grow flex flex-col bg-white rounded-[48px] p-16 shadow-2xl border border-[#5a5a40]/10 relative overflow-hidden"
                >
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#5a5a40]/5 rounded-bl-full -mr-32 -mt-32 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#5a5a40]/5 rounded-tr-full -ml-24 -mb-24 pointer-events-none" />
                  
                  <div className="relative z-10">
                    <div className="text-center mb-20">
                      <div className="w-24 h-24 bg-[#5a5a40] text-white rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                        <Sparkles className="w-12 h-12" />
                      </div>
                      <h2 className="text-5xl font-bold text-[#2a2a20] tracking-tight">社群生态梳理报告</h2>
                      <div className="flex items-center justify-center gap-4 mt-4">
                        <div className="h-px w-12 bg-[#5a5a40]/20" />
                        <p className="text-[#6a6a50] italic font-serif">“孩子，这是你一步步走出来的脉络。”</p>
                        <div className="h-px w-12 bg-[#5a5a40]/20" />
                      </div>
                    </div>

                    <div className="space-y-16 max-w-3xl mx-auto w-full">
                      {/* 01. Theme */}
                      <section className="relative">
                        <div className="absolute -left-12 top-0 text-6xl font-serif italic opacity-5 text-[#5a5a40] pointer-events-none">01</div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#5a5a40] mb-6 flex items-center gap-4">
                          主题灵魂 / Soul of Community
                          <div className="flex-grow h-px bg-gradient-to-r from-[#5a5a40]/20 to-transparent" />
                        </h3>
                        <div className="p-10 bg-[#fcfcf9] rounded-[40px] border border-[#5a5a40]/5 shadow-inner">
                          <div className="inline-block px-6 py-2 bg-[#5a5a40] text-white rounded-full text-xl font-bold mb-6 shadow-lg shadow-[#5a5a40]/20">
                            {formatKeyword(progress.theme.keyword)}
                          </div>
                          <p className="text-xl leading-relaxed text-[#4a4a30] font-medium italic">
                            {progress.theme.description || "尚未填写描述..."}
                          </p>
                        </div>
                      </section>

                      {/* 02. Practitioners & Activities Grid */}
                      <div className="grid grid-cols-2 gap-12">
                        <section className="relative">
                          <div className="absolute -left-8 top-0 text-4xl font-serif italic opacity-5 text-[#5a5a40] pointer-events-none">02</div>
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#5a5a40] mb-6 flex items-center gap-3">
                            实践者链接 / Practitioners
                            <div className="flex-grow h-px bg-gradient-to-r from-[#5a5a40]/20 to-transparent" />
                          </h3>
                          <div className="space-y-3">
                            {progress.practitioners.filter(p => p.trim()).length > 0 ? (
                              progress.practitioners.filter(p => p.trim()).map((p, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#5a5a40]/10 shadow-sm">
                                  <div className="w-8 h-8 rounded-xl bg-[#5a5a40]/5 flex items-center justify-center text-[#5a5a40] font-bold text-xs">
                                    {i + 1}
                                  </div>
                                  <span className="font-bold text-[#2a2a20] text-sm">{p}</span>
                                </div>
                              ))
                            ) : (
                              <div className="p-6 bg-[#fcfcf9] rounded-2xl border border-dashed border-[#5a5a40]/20 text-center text-[10px] text-[#5a5a40]/40 italic">
                                尚未列出
                              </div>
                            )}
                          </div>
                        </section>

                        <section className="relative">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#5a5a40] mb-6 flex items-center gap-3">
                            活动环节 / Activities
                            <div className="flex-grow h-px bg-gradient-to-r from-[#5a5a40]/20 to-transparent" />
                          </h3>
                          <div className="space-y-3">
                            {progress.activities.filter(a => a.trim()).length > 0 ? (
                              progress.activities.filter(a => a.trim()).map((a, i) => (
                                <div key={i} className="p-4 bg-[#fcfcf9] rounded-2xl border-l-4 border-[#5a5a40] text-sm">
                                  <span className="block text-[10px] font-bold text-[#5a5a40]/40 uppercase mb-1">Step {i + 1}</span>
                                  <span className="text-[#2a2a20] font-medium">{a}</span>
                                </div>
                              ))
                            ) : (
                              <div className="p-6 bg-[#fcfcf9] rounded-2xl border border-dashed border-[#5a5a40]/20 text-center text-[10px] text-[#5a5a40]/40 italic">
                                未填写
                              </div>
                            )}
                          </div>
                        </section>
                      </div>

                      {/* 03. Products */}
                      <section className="relative">
                        <div className="absolute -left-12 top-0 text-6xl font-serif italic opacity-5 text-[#5a5a40] pointer-events-none">03</div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#5a5a40] mb-6 flex items-center gap-4">
                          产品载体 / Products
                          <div className="flex-grow h-px bg-gradient-to-r from-[#5a5a40]/20 to-transparent" />
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {progress.products.filter(p => p.trim()).length > 0 ? (
                            progress.products.filter(p => p.trim()).map((p, i) => (
                              <div key={i} className="p-5 bg-white rounded-3xl border border-[#5a5a40]/10 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                                <div className="w-10 h-10 rounded-2xl bg-[#5a5a40]/5 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-[#5a5a40]" />
                                </div>
                                <span className="text-[#2a2a20] font-bold">{p}</span>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 p-8 bg-[#fcfcf9] rounded-3xl border border-dashed border-[#5a5a40]/20 text-center text-[#5a5a40]/40 italic">
                              尚未列出产品
                            </div>
                          )}
                        </div>
                      </section>

                      {/* 04. Co-creation */}
                      <section className="relative">
                        <div className="absolute -left-12 top-0 text-6xl font-serif italic opacity-5 text-[#5a5a40] pointer-events-none">04</div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#5a5a40] mb-6 flex items-center gap-4">
                          共创行动 / Co-Creation Matrix
                          <div className="flex-grow h-px bg-gradient-to-r from-[#5a5a40]/20 to-transparent" />
                        </h3>
                        <div className="bg-[#5a5a40] rounded-[40px] p-10 shadow-2xl shadow-[#5a5a40]/20">
                          <div className="space-y-6">
                            {(Object.entries(progress.coCreation) as [string, string][]).filter(([_, v]) => v.trim()).length > 0 ? (
                              (Object.entries(progress.coCreation) as [string, string][]).filter(([_, v]) => v.trim()).map(([practitioner, content], i) => (
                                <div key={i} className="flex flex-col gap-3 p-6 bg-white/10 rounded-3xl border border-white/10 backdrop-blur-sm">
                                  <div className="flex items-center gap-3 text-white/60 text-[10px] font-bold uppercase tracking-widest">
                                    <span>{formatKeyword(progress.theme.keyword)}</span>
                                    <X className="w-3 h-3" />
                                    <span>{practitioner}</span>
                                  </div>
                                  <div className="text-xl text-white font-bold">
                                    {content}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-10 border border-dashed border-white/20 rounded-3xl text-center text-white/40 italic">
                                尚未开启共创行动
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Closing Message */}
                      <div className="pt-12 text-center">
                        <div className="inline-block p-8 bg-[#f5f5f0] rounded-[40px] max-w-lg">
                          <p className="text-[#5a5a40] leading-relaxed italic">
                            “社群不是建出来的，是长出来的。愿你在这些脉络中，找到属于你的森林。”
                          </p>
                          <div className="mt-6 flex items-center justify-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#5a5a40] flex items-center justify-center text-white text-xs">村</div>
                            <span className="text-xs font-bold text-[#5a5a40] uppercase tracking-widest">村口老爷爷 · 寄语</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <footer className="mt-24 flex justify-center gap-8 no-print">
                      <button 
                        onClick={handleBack}
                        className="px-10 py-4 rounded-full font-bold border-2 border-[#5a5a40]/10 text-[#5a5a40] hover:bg-[#5a5a40] hover:text-white hover:border-[#5a5a40] transition-all"
                      >
                        返回修改
                      </button>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setShowSaveOptions(!showSaveOptions)}
                          disabled={isGeneratingImage}
                          className="px-12 py-4 bg-[#5a5a40] text-white rounded-full font-bold shadow-2xl shadow-[#5a5a40]/30 hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScrollText className="w-5 h-5" />}
                          {isGeneratingImage ? '正在生成...' : '保存报告'}
                        </button>

                        <AnimatePresence>
                          {showSaveOptions && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-0 right-0 mb-4 bg-white rounded-3xl shadow-2xl border border-[#5a5a40]/10 overflow-hidden z-50"
                            >
                              <button 
                                onClick={handleDownloadPDF}
                                className="w-full px-6 py-4 flex items-center gap-3 hover:bg-[#f5f5f0] transition-colors text-[#5a5a40] font-bold border-b border-[#5a5a40]/5"
                              >
                                <FileText className="w-5 h-5" />
                                <span>保存为 PDF</span>
                              </button>
                              <button 
                                onClick={handleDownloadImage}
                                className="w-full px-6 py-4 flex items-center gap-3 hover:bg-[#f5f5f0] transition-colors text-[#5a5a40] font-bold"
                              >
                                <ImageIcon className="w-5 h-5" />
                                <span>保存为图片 (PNG)</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </footer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(90, 90, 64, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(90, 90, 64, 0.2);
        }
        @media print {
          .no-print {
            display: none !important;
          }
          aside {
            display: none !important;
          }
          main {
            padding: 0 !important;
            background: white !important;
          }
          .custom-scrollbar {
            overflow: visible !important;
          }
          .rounded-[48px] {
            border-radius: 0 !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `}} />
    </div>
  );
}
