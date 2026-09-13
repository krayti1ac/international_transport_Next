'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sparkles,
  Calculator,
  ShieldCheck,
  MessageSquare,
  X,
  TrendingUp,
  Fuel,
  Ship,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  DollarSign,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  calculateTripFeasibility,
  auditCrossBorderReadiness,
  askTransBodanonCopilot,
} from '../services/copilot.actions';
import type {
  TripFeasibilityResult,
  ReadinessAuditResult,
  CopilotChatMessage,
  CargoType,
  FerryRoute,
} from '../types';

interface TransBodanonCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrip?: {
    origin?: string;
    destination?: string;
    truckId?: number;
    driverId?: number;
  };
}

export function TransBodanonCopilotModal({
  isOpen,
  onClose,
  initialTrip,
}: TransBodanonCopilotModalProps) {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'calculator' | 'readiness' | 'chat'>('calculator');

  // Calculator State
  const [origin, setOrigin] = useState(initialTrip?.origin || 'Casablanca');
  const [destination, setDestination] = useState(initialTrip?.destination || 'Paris');
  const [cargoType, setCargoType] = useState<CargoType>('reefer');
  const [ferryRoute, setFerryRoute] = useState<FerryRoute>('tanger_med_algeciras');
  const [targetMargin, setTargetMargin] = useState(22);
  const [feasibility, setFeasibility] = useState<TripFeasibilityResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Readiness State
  const [readiness, setReadiness] = useState<ReadinessAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        'مرحباً بك! أنا مساعد Trans Bodanon الذكي لعمليات النقل الدولي (TIR). كيف يمكنني مساعدتك اليوم في تسعير الرحلات، تدقيق وثائق العبور، أو اختيار المسارات؟',
      timestamp: 'الآن',
      quickReplies: [
        'احسب تكلفة رحلة من الدار البيضاء إلى باريس',
        'ما هي أوقات راحة السائق الإلزامية في أوروبا؟',
        'أفضل محطات التزود بالوقود في إسبانيا',
      ],
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const runCalculation = useCallback(async () => {
    setCalculating(true);
    try {
      const res = await calculateTripFeasibility({
        origin,
        destination,
        cargoType,
        ferryRoute,
        targetMarginPercent: targetMargin,
      });
      setFeasibility(res);
    } finally {
      setCalculating(false);
    }
  }, [origin, destination, cargoType, ferryRoute, targetMargin]);

  const runAuditing = useCallback(async () => {
    setAuditing(true);
    try {
      const res = await auditCrossBorderReadiness({
        truckId: initialTrip?.truckId,
        driverId: initialTrip?.driverId,
      });
      setReadiness(res);
    } finally {
      setAuditing(false);
    }
  }, [initialTrip?.truckId, initialTrip?.driverId]);

  useEffect(() => {
    if (isOpen) {
      runCalculation();
      runAuditing();
    }
  }, [isOpen, runCalculation, runAuditing]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || chatLoading) return;

    const userMsg: CopilotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: query,
      timestamp: 'الآن',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setChatLoading(true);

    try {
      const reply = await askTransBodanonCopilot(query);
      setMessages((prev) => [...prev, reply]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-background border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={dir}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-blue-500/20 to-purple-500/20 text-primary flex items-center justify-center border border-primary/30 shadow-xs">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-amiri text-foreground">
                  {t('Trans Bodanon AI Copilot — المساعد اللوجستي الذكي', 'Trans Bodanon AI Copilot')}
                </h2>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary font-mono">
                  v3.0 TIR AI
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'استشارات الجدوى، تحسين هوامش الربح بـ Decimal.js، وتدقيق الجاهزية الجمركية',
                  'Optimisation marge Decimal.js, audit réglementaire et assistance opérationnelle'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'calculator'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calculator className="w-4 h-4" />
            {t('حاسبة الجدوى والربحية', 'Rentabilité & Prix')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('readiness')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'readiness'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {t('مدقق الجاهزية والوثائق', 'Audit Conformité Douane')}
            {readiness && (
              <Badge
                variant="outline"
                className={`text-[10px] ms-1 ${
                  readiness.status === 'ready'
                    ? 'text-emerald-600 border-emerald-500/30'
                    : 'text-amber-600 border-amber-500/30'
                }`}
              >
                {readiness.score}%
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'chat'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {t('المساعد التشغيلي المباشر', 'Assistant Opérationnel')}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'calculator' && (
            <div className="space-y-5">
              {/* Form Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t('نقطة الانطلاق (Maroc)', 'Origine')}
                  </label>
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Casablanca, Agadir..."
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t('نقطة الوصول (Europe)', 'Destination')}
                  </label>
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Paris, Madrid, Rotterdam..."
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t('طبيعة الحمولة', 'Type de fret')}
                  </label>
                  <select
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value as CargoType)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="reefer">{t('مبردة (Frigo) فواكه/خضار', 'Frigorifique (Fruits/Légumes)')}</option>
                    <option value="dry">{t('بضائع عامة جافة (Bâche/Fourgon)', 'Marchandise Générale')}</option>
                    <option value="hazardous">{t('خطرة ADR (Matières dangereuses)', 'Matières Dangereuses ADR')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t('خط العبّارة البحرية', 'Traversée Maritime')}
                  </label>
                  <select
                    value={ferryRoute}
                    onChange={(e) => setFerryRoute(e.target.value as FerryRoute)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="tanger_med_algeciras">طنجة المتوسط ⇄ الجزيرة الخضراء (1h30)</option>
                    <option value="tanger_med_motril">طنجة المتوسط ⇄ موتريل (4h00)</option>
                    <option value="nador_almeria">الناظور ⇄ ألميريا</option>
                  </select>
                </div>
              </div>

              {/* Target Margin Slider */}
              <div className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t('هامش الربح الصافي المستهدف:', 'Marge nette ciblée :')} <span className="font-bold text-primary font-mono">{targetMargin}%</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('يقوم المحرك باحتساب السعر الأنسب لضمان تحقيق هذه النسبة بعد خصم كافة التكاليف التشغيلية.', 'Calcul du prix optimal pour garantir cette marge nette.')}
                  </p>
                </div>
                <div className="flex items-center gap-3 w-48">
                  <input
                    type="range"
                    min="15"
                    max="35"
                    step="1"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={calculating}
                    onClick={runCalculation}
                    className="rounded-xl text-xs h-8 px-3 gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t('حساب', 'Calculer')}
                  </Button>
                </div>
              </div>

              {/* Results Cards */}
              {feasibility && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <Card className="border-primary/40 bg-primary/5 shadow-xs">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold text-primary">{t('سعر الشحن الموصى به للعميل', 'Prix Conseillé Client')}</p>
                        <p className="text-2xl font-bold font-mono text-foreground mt-1" dir="ltr">
                          {feasibility.recommendedPriceMad} MAD
                        </p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5" dir="ltr">
                          ≈ {feasibility.recommendedPriceEur} EUR
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{t('التكلفة التشغيلية الإجمالية (Direct Cost)', 'Coût de revient direct')}</p>
                        <p className="text-xl font-bold font-mono text-rose-600 mt-1" dir="ltr">
                          {feasibility.totalCostMad} MAD
                        </p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5" dir="ltr">
                          ≈ {feasibility.totalCostEur} EUR (نقطة التعادل)
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{t('صافي الربح المتوقع (Net Profit)', 'Bénéfice Net Projeté')}</p>
                        <p className="text-xl font-bold font-mono text-emerald-600 mt-1" dir="ltr">
                          +{feasibility.projectedProfitMad} MAD
                        </p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5" dir="ltr">
                          ≈ +{feasibility.projectedProfitEur} EUR ({feasibility.targetMarginPercent}%)
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Cost Breakdown Progress */}
                  <Card className="border border-border shadow-xs">
                    <CardHeader className="py-3 px-4 border-b border-border">
                      <CardTitle className="text-xs font-bold text-foreground">
                        {t('هيكل وتفصيل التكاليف التشغيلية (Itemized Cost Structure)', 'Structure des Coûts')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-2">
                        {feasibility.breakdown.map((item) => (
                          <div key={item.key} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                {dir === 'rtl' ? item.labelAr : item.labelFr}
                              </span>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-muted-foreground">{item.percentage}%</span>
                                <span className="font-semibold text-foreground" dir="ltr">
                                  {item.amountMad} MAD
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/80 rounded-full"
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {t('المسافة التقديرية:', 'Distance :')} <strong className="text-foreground font-mono">{feasibility.estimatedDistanceKm} km</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {t('الاستراحات الإلزامية (EC 561/2006):', 'Pauses obligatoires :')}{' '}
                            <strong className="text-foreground font-mono">{feasibility.routeInsights.mandatoryRestPauses} pauses</strong>
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === 'readiness' && (
            <div className="space-y-4">
              {readiness && (
                <>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            readiness.status === 'ready'
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                          }
                        >
                          {readiness.status === 'ready'
                            ? t('جاهز للعبور الدولي فوراً', 'Conforme pour le départ')
                            : t('تنبيهات تتطلب المعالجة', 'Vérification requise')}
                        </Badge>
                        <span className="font-bold text-xs font-mono">{readiness.score}% Readiness</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dir === 'rtl' ? readiness.summaryAr : readiness.summaryFr}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={auditing}
                      onClick={runAuditing}
                      className="rounded-xl text-xs h-8 gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('إعادة التدقيق', 'Réauditer')}
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {readiness.checks.map((check) => (
                      <div
                        key={check.id}
                        className="p-3 rounded-xl border border-border bg-card flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {check.status === 'passed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : check.status === 'warning' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span className="font-semibold text-foreground">
                              {dir === 'rtl' ? check.titleAr : check.titleFr}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {check.category}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-[11px] ps-6">
                            {dir === 'rtl' ? check.detailsAr : check.detailsFr}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            check.status === 'passed'
                              ? 'text-emerald-600'
                              : check.status === 'warning'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {check.status === 'passed' ? t('مطابق', 'Conforme') : t('ناقص', 'Incomplet')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-4 flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto space-y-3 p-2 rounded-xl bg-muted/10 border border-border">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                        m.sender === 'user'
                          ? 'bg-primary text-primary-foreground rounded-ee-xs'
                          : 'bg-muted border border-border text-foreground rounded-es-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{m.timestamp}</span>

                    {m.quickReplies && m.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.quickReplies.map((qr, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(qr)}
                            className="px-2.5 py-1 rounded-full text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-xs text-muted-foreground animate-pulse p-2">
                    {t('المساعد الذكي يفكر...', 'Copilot réfléchit...')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder={t('اكتب سؤالك اللوجستي هنا (مثال: أوقات الراحة، محطات الوقود، أسعار النقل)...', 'Posez votre question logistique...')}
                  className="h-10 text-xs rounded-xl"
                />
                <Button
                  type="button"
                  disabled={!inputPrompt.trim() || chatLoading}
                  onClick={() => handleSendMessage()}
                  className="rounded-xl h-10 px-4 gap-1.5"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

