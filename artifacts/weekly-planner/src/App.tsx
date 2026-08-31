import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetPlannerDataQueryKey,
  useAnalyzePlannerReview,
  useGetPlannerData,
  useSavePlannerData,
  type PlannerData,
  type ReviewAnalysisEntry,
  type Role,
} from '@workspace/api-client-react';
import { CalendarDays, Check, ChevronLeft, ClipboardList, LogOut, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Redirect, Route, Router as WouterRouter, Switch, Link, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as const;
type Day = (typeof DAYS)[number];
type ReviewFormEntry = {
  roleId: string;
  roleName: string;
  goalField: string;
  goalText: string;
  statusVal: string;
  reason: string;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const emptyRole = (): Role => ({ id: crypto.randomUUID(), name: '', goal1: '', goal2: '' });

function defaultData(): PlannerData {
  return {
    weekEndDate: '',
    roles: [emptyRole(), emptyRole(), emptyRole(), emptyRole()],
    schedule: Object.fromEntries(DAYS.map((day) => [day, ''])) as unknown as PlannerData['schedule'],
    reflection: '',
    review: null,
  };
}

function normalizeData(value?: PlannerData | null): PlannerData {
  if (!value) return defaultData();
  return {
    ...value,
    roles: value.roles?.length ? value.roles : [emptyRole()],
    schedule: Object.fromEntries(DAYS.map((day) => [day, value.schedule?.[day] ?? ''])) as unknown as PlannerData['schedule'],
    review: value.review ?? null,
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateArabic(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysRemainingLabel(dateStr: string) {
  const diffMs = new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days > 1) return `باقي ${days} أيام`;
  if (days === 1) return 'باقي يوم واحد';
  if (days === 0) return 'الأسبوع بيخلص النهاردة';
  return 'الأسبوع خلص، تقدر تراجعه';
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex items-center gap-3'} data-testid="brand-planner">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ClipboardList className="size-5" strokeWidth={1.8} />
      </div>
      {!compact && <span className="text-sm font-semibold tracking-tight">المربع الثاني</span>}
    </div>
  );
}

function Landing() {
  return (
    <main dir="rtl" className="min-h-[100dvh] px-5 py-6 sm:px-8 sm:py-8" data-testid="landing-page">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between" data-testid="landing-nav">
        <BrandMark compact />
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="planner-button" data-testid="link-sign-in">تسجيل الدخول</Link>
          <Link href="/sign-up" className="planner-button planner-button-primary" data-testid="link-sign-up">إنشاء حساب</Link>
        </div>
      </nav>
      <section className="mx-auto grid min-h-[calc(100dvh-112px)] w-full max-w-6xl items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20" data-testid="landing-content">
        <div className="max-w-xl">
          <p className="mb-5 flex items-center gap-2 text-sm font-medium text-primary" data-testid="text-landing-kicker">
            <span className="h-px w-8 bg-primary" />
            مساحة أسبوعية هادئة
          </p>
          <h1 className="text-4xl font-semibold leading-[1.25] tracking-tight text-foreground sm:text-6xl" data-testid="text-landing-title">
            خطّط للأهم،<br /><span className="text-primary">وسيبه ياخد مكانه.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-muted-foreground" data-testid="text-landing-description">
            مساحة شخصية تساعدك ترتب أدوارك وأهدافك في المربع الثاني، وتراجع أسبوعك من غير زحمة ولا إحساس بالذنب.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="planner-button planner-button-primary inline-flex items-center gap-2 px-5 py-3" data-testid="link-start-planning">
              ابدأ التخطيط <ChevronLeft className="size-4" />
            </Link>
            <Link href="/sign-in" className="planner-button inline-flex items-center gap-2 px-5 py-3" data-testid="link-existing-account">
              عندك حساب؟ ادخل
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md" data-testid="landing-illustration">
          <div className="absolute -inset-6 rounded-[2rem] bg-accent/35 blur-3xl" />
          <div className="relative rotate-[2deg] rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-[11px] text-muted-foreground">تاريخ نهاية الأسبوع</p>
                <p className="mt-1 text-sm font-semibold">الجمعة، ١٦ مايو</p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="space-y-3">
              {['الأدوار وأهداف الأسبوع', 'جدول الأسبوع', 'التكيف اليومي — ملاحظات'].map((label, index) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3" data-testid={`card-landing-preview-${index}`}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">{index + 1}</span>
                  <span className="text-sm font-medium">{label}</span>
                  {index === 0 && <Check className="mr-auto size-4 text-primary" />}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs opacity-80">هذا الأسبوع</p>
              <p className="mt-1 text-sm font-semibold">الأهم قبل الملح</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SignInPage() {
  return (
    <div dir="rtl" className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-8" data-testid="sign-in-page">
      <div className="mb-6"><BrandMark /></div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div dir="rtl" className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-8" data-testid="sign-up-page">
      <div className="mb-6"><BrandMark /></div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="planner-shell" dir="rtl" data-testid="planner-loading">
      <div className="planner-wrap space-y-5">
        <div className="planner-skeleton h-10 w-72" />
        <div className="planner-skeleton h-24 w-full" />
        <div className="planner-skeleton h-56 w-full" />
        <div className="planner-skeleton h-64 w-full" />
      </div>
    </div>
  );
}

function PlannerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="planner-shell flex items-center justify-center" dir="rtl">
      <div className="planner-card max-w-md text-center" data-testid="planner-error">
        <h2 className="text-lg font-bold">حصل خطأ في تحميل الجدول</h2>
        <p className="mt-2 text-sm text-muted-foreground">جرب تاني بعد لحظة.</p>
        <button type="button" onClick={onRetry} className="planner-button planner-button-primary mt-5" data-testid="button-retry-planner">حاول تاني</button>
      </div>
    </div>
  );
}

function PlannerPage() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const plannerQuery = useGetPlannerData({
    query: { enabled: Boolean(userId), queryKey: getGetPlannerDataQueryKey() },
  });
  const saveMutation = useSavePlannerData();
  const analyzeMutation = useAnalyzePlannerReview();
  const queryClient = useQueryClient();
  const [data, setData] = useState<PlannerData>(defaultData);
  const [status, setStatus] = useState('');
  const [screen, setScreen] = useState<'plan' | 'reviewIntro' | 'reviewForm' | 'reviewResult'>('plan');
  const [reviewEntries, setReviewEntries] = useState<ReviewFormEntry[]>([]);
  const [analyzeError, setAnalyzeError] = useState('');
  const initializedForUser = useRef<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    initializedForUser.current = null;
    setData(defaultData());
    setScreen('plan');
  }, [userId]);

  useEffect(() => {
    if (!userId || !plannerQuery.data || initializedForUser.current === userId) return;
    const next = normalizeData(plannerQuery.data);
    initializedForUser.current = userId;
    setData(next);
    if (next.weekEndDate && next.weekEndDate < todayStr() && !next.review) setScreen('reviewIntro');
  }, [plannerQuery.data, userId]);

  const save = useCallback(async (next: PlannerData) => {
    setData(next);
    const saveTask = saveQueueRef.current.then(async () => {
      try {
        await saveMutation.mutateAsync({ data: next });
        await queryClient.invalidateQueries({ queryKey: getGetPlannerDataQueryKey() });
        setStatus('اتحفظ');
        window.setTimeout(() => setStatus(''), 1200);
      } catch {
        setStatus('حصل خطأ في الحفظ');
      }
    });
    saveQueueRef.current = saveTask;
    await saveTask;
  }, [queryClient, saveMutation]);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    try {
      if (typeof pickerInput.showPicker === 'function') {
        pickerInput.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  };

  const updateRole = (id: string, field: keyof Role, value: string) => {
    void save({ ...data, roles: data.roles.map((role) => role.id === id ? { ...role, [field]: value } : role) });
  };

  const addRole = () => {
    if (data.roles.length >= 7) return;
    void save({ ...data, roles: [...data.roles, emptyRole()] });
  };

  const removeRole = (id: string) => {
    void save({ ...data, roles: data.roles.filter((role) => role.id !== id) });
  };

  const updateSchedule = (day: Day, value: string) => {
    void save({ ...data, schedule: { ...data.schedule, [day]: value } });
  };

  const resetAll = () => {
    if (window.confirm('تمسح كل حاجة وتبدأ أسبوع جديد؟')) {
      void save(defaultData());
      setScreen('plan');
    }
  };

  const goalList = useMemo(() => {
    const list: Array<{ roleId: string; roleName: string; goalField: string; goalText: string }> = [];
    data.roles.forEach((role) => {
      if (!role.name.trim()) return;
      if (role.goal1.trim()) list.push({ roleId: role.id, roleName: role.name, goalField: 'goal1', goalText: role.goal1 });
      if (role.goal2.trim()) list.push({ roleId: role.id, roleName: role.name, goalField: 'goal2', goalText: role.goal2 });
    });
    return list;
  }, [data.roles]);

  const openReviewIntro = () => setScreen('reviewIntro');
  const startReview = () => {
    setReviewEntries(goalList.map((goal) => ({ ...goal, statusVal: '', reason: '' })));
    setAnalyzeError('');
    setScreen('reviewForm');
  };

  const updateEntry = (index: number, field: 'statusVal' | 'reason', value: string) => {
    setReviewEntries((previous) => previous.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  };

  const submitReview = async () => {
    if (reviewEntries.some((entry) => !entry.statusVal)) {
      setAnalyzeError('حدد حالة كل هدف الأول (تم / جزئيًا / لأ)');
      return;
    }
    setAnalyzeError('');
    try {
      const entries: ReviewAnalysisEntry[] = reviewEntries.map((entry) => ({
        role: entry.roleName,
        goal: entry.goalText,
        status: entry.statusVal,
        reason: entry.reason || null,
      }));
      const result = await analyzeMutation.mutateAsync({ data: { entries } });
      const combinedEntries = reviewEntries.map((entry, index) => ({
        ...entry,
        advice: result.items[index].advice,
        concept: result.items[index].concept,
      }));
      const nextData: PlannerData = {
        ...data,
        review: {
          entries: combinedEntries,
          message: result.message,
          completedAt: new Date().toISOString(),
        },
      };
      await save(nextData);
      setScreen('reviewResult');
    } catch (error) {
      setAnalyzeError(`حصل خطأ في التحليل: ${error instanceof Error ? error.message : 'جرب تاني.'}`);
    }
  };

  const startNewWeekFromReview = () => {
    const carriedRoles = data.roles.map((role) => ({ ...role, id: crypto.randomUUID(), goal1: '', goal2: '' }));
    void save({ ...defaultData(), roles: carriedRoles.length ? carriedRoles : [emptyRole()] });
    setScreen('plan');
  };

  if (plannerQuery.isLoading || !initializedForUser.current) return <PlannerSkeleton />;
  if (plannerQuery.isError) return <PlannerError onRetry={() => void plannerQuery.refetch()} />;

  if (screen === 'reviewIntro') {
    const hasGoals = goalList.length > 0;
    return (
      <div className="planner-shell" dir="rtl" data-testid="screen-review-intro">
        <div className="planner-wrap">
          <div className="planner-card px-6 py-8 text-center">
            <h2 className="mb-2 text-lg font-bold" data-testid="text-review-intro-title">{data.weekEndDate && data.weekEndDate < todayStr() ? 'الأسبوع خلص' : 'مراجعة الأسبوع'}</h2>
            <p className="mb-5 text-sm text-muted-foreground" data-testid="text-review-intro-description">
              {hasGoals ? 'تحب تراجع الأهداف اللي حطيتها وتشوف وصلت فين؟' : 'معندكش أهداف مسجلة للأسبوع ده، ارجع للجدول وحدد أهدافك الأول.'}
            </p>
            <div className="flex justify-center gap-2.5">
              {hasGoals && <button type="button" onClick={startReview} className="planner-button planner-button-primary" data-testid="button-start-review">ابدأ المراجعة</button>}
              <button type="button" onClick={() => setScreen('plan')} className="planner-button" data-testid="button-review-not-now">{hasGoals ? 'مش دلوقتي' : 'رجوع للجدول'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'reviewForm') {
    return (
      <div className="planner-shell" dir="rtl" data-testid="screen-review-form">
        <div className="planner-wrap">
          <h2 className="mb-1 text-lg font-bold" data-testid="text-review-form-title">مراجعة الأسبوع</h2>
          <p className="mb-4 text-[13px] text-muted-foreground">لكل هدف، حدد وصلت فين، ولو مكنش تم، تقدر (مش لازم) تقول ليه باختصار.</p>
          <div className="flex flex-col gap-3">
            {reviewEntries.map((entry, index) => (
              <div key={`${entry.roleId}-${entry.goalField}`} className="planner-card" data-testid={`card-review-entry-${index}`}>
                <p className="mb-0.5 text-[13px] text-muted-foreground">{entry.roleName}</p>
                <p className="mb-2.5 text-[15px] font-semibold">{entry.goalText}</p>
                <div className="mb-2 flex gap-2">
                  {['تم', 'جزئيًا', 'لأ'].map((value) => (
                    <button type="button" key={value} onClick={() => updateEntry(index, 'statusVal', value)} className={`planner-button flex-1 ${entry.statusVal === value ? 'planner-button-primary' : ''}`} data-testid={`button-review-status-${index}-${value}`}>
                      {value}
                    </button>
                  ))}
                </div>
                {entry.statusVal && entry.statusVal !== 'تم' && (
                  <textarea value={entry.reason} onChange={(event) => updateEntry(index, 'reason', event.target.value)} placeholder="ليه؟ (اختياري)" rows={2} className="planner-input resize-y" data-testid={`textarea-review-reason-${index}`} />
                )}
              </div>
            ))}
          </div>
          {analyzeError && <p className="mt-2.5 text-[13px] text-destructive" data-testid="status-analyze-error">{analyzeError}</p>}
          <div className="mt-4 flex gap-2.5">
            <button type="button" onClick={() => void submitReview()} disabled={analyzeMutation.isPending} className="planner-button planner-button-primary" data-testid="button-submit-review">
              {analyzeMutation.isPending ? 'بيحلل...' : 'اعرض التحليل'}
            </button>
            <button type="button" onClick={() => setScreen('plan')} disabled={analyzeMutation.isPending} className="planner-button" data-testid="button-back-from-review">رجوع</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'reviewResult' && data.review) {
    return (
      <div className="planner-shell" dir="rtl" data-testid="screen-review-result">
        <div className="planner-wrap">
          <h2 className="mb-4 text-lg font-bold" data-testid="text-review-result-title">نتيجة مراجعة الأسبوع</h2>
          <div className="mb-4 flex flex-col gap-3">
            {data.review.entries.map((entry, index) => (
              <div key={`${entry.roleId}-${entry.goalField}-${index}`} className="planner-card" data-testid={`card-review-result-${index}`}>
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-xs text-muted-foreground">{entry.roleName}</p>
                    <p className="mt-0.5 text-[15px] font-semibold">{entry.goalText}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${entry.statusVal === 'تم' ? 'bg-[#eaf3de] text-[#27500a]' : entry.statusVal === 'جزئيًا' ? 'bg-[#faeeda] text-[#633806]' : 'bg-[#fcebeb] text-[#791f1f]'}`} data-testid={`status-review-result-${index}`}>{entry.statusVal}</span>
                </div>
                <p className="my-2 text-sm leading-[1.7]">{entry.advice}</p>
                <p className="m-0 text-[11px] text-muted-foreground">من الكتاب: {entry.concept}</p>
              </div>
            ))}
          </div>
          <div className="planner-card border-[#c0dd97] bg-[#eaf3de]" data-testid="card-review-message">
            <p className="m-0 text-sm font-semibold leading-[1.7] text-[#27500a]">{data.review.message}</p>
          </div>
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={() => setScreen('plan')} className="planner-button" data-testid="button-back-to-plan">رجوع للجدول</button>
            <button type="button" onClick={startNewWeekFromReview} className="planner-button text-primary" data-testid="button-start-new-week">ابدأ أسبوع جديد</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="planner-shell" dir="rtl" data-testid="planner-page">
      <div className="planner-wrap">
        <PlannerHeader onReview={openReviewIntro} />
        {data.review && (
          <div className="planner-card mb-4 flex items-center justify-between gap-3 border-[#c0dd97] bg-[#eaf3de]" data-testid="status-review-complete">
            <span className="text-[13px] text-[#27500a]">الأسبوع ده اتراجع بالفعل</span>
            <button type="button" onClick={() => setScreen('reviewResult')} className="planner-button px-2.5 py-1.5 text-xs" data-testid="button-view-review-result">شوف النتيجة</button>
          </div>
        )}
        <div className="planner-card mb-6 flex flex-wrap items-center justify-between gap-3" data-testid="card-week-end-date">
          <div>
            <p className="mb-0.5 text-xs text-muted-foreground">تاريخ نهاية الأسبوع</p>
            {data.weekEndDate ? (
              <>
                <p className="mb-0.5 text-base font-semibold" data-testid="text-week-end-date">{formatDateArabic(data.weekEndDate)}</p>
                <p className="m-0 text-xs text-muted-foreground" data-testid="text-days-remaining">{daysRemainingLabel(data.weekEndDate)}</p>
              </>
            ) : <p className="m-0 text-sm text-muted-foreground" data-testid="text-date-empty">حدد الأسبوع عشان تقدر تراجعه في وقته</p>}
          </div>
          <button type="button" onClick={openDatePicker} className="planner-button relative inline-flex cursor-pointer items-center gap-1.5 overflow-hidden" data-testid="label-week-end-date">
            {data.weekEndDate ? 'تغيير التاريخ' : 'حدد التاريخ'}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={data.weekEndDate}
            onChange={(event) => void save({ ...data, weekEndDate: event.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="input-week-end-date"
          />
        </div>

        <section className="mb-8" data-testid="section-roles">
          <h2 className="mb-1 text-[17px] font-bold">١. الأدوار وأهداف الأسبوع</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">اكتب أهم أدوارك في حياتك وحط هدف أو اتنين لكل دور لِلأسبوع ده.</p>
          <div className="flex flex-col gap-2.5">
            {data.roles.map((role) => (
              <div key={role.id} className="planner-card" data-testid={`card-role-${role.id}`}>
                <div className="mb-2 flex items-center gap-2">
                  <input type="text" value={role.name} onChange={(event) => updateRole(role.id, 'name', event.target.value)} placeholder="اسم الدور (مثلاً: الأب، الطالب، الموظف)" className="planner-input flex-1 font-semibold" data-testid={`input-role-name-${role.id}`} />
                  <button type="button" onClick={() => removeRole(role.id)} aria-label="حذف الدور" className="planner-button planner-button-danger px-2.5 py-1.5" data-testid={`button-delete-role-${role.id}`}><Trash2 className="size-3.5 sm:hidden" /><span className="hidden sm:inline">حذف</span></button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input type="text" value={role.goal1} onChange={(event) => updateRole(role.id, 'goal1', event.target.value)} placeholder="هدف ١ لهذا الأسبوع" className="planner-input" data-testid={`input-role-goal1-${role.id}`} />
                  <input type="text" value={role.goal2} onChange={(event) => updateRole(role.id, 'goal2', event.target.value)} placeholder="هدف ٢ (اختياري)" className="planner-input" data-testid={`input-role-goal2-${role.id}`} />
                </div>
              </div>
            ))}
          </div>
          {data.roles.length < 7 && <button type="button" onClick={addRole} className="planner-button mt-2.5 inline-flex items-center gap-1.5" data-testid="button-add-role"><Plus className="size-4" />ضيف دور</button>}
        </section>

        <section className="mb-8" data-testid="section-schedule">
          <h2 className="mb-1 text-[17px] font-bold">٢. جدول الأسبوع</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">حط الأهداف اللي فوق فعليًا في أيام محددة.</p>
          <div className="flex flex-col gap-2">
            {DAYS.map((day) => (
              <div key={day} className="grid grid-cols-[76px_1fr] items-start gap-2.5 sm:grid-cols-[90px_1fr]" data-testid={`row-schedule-${day}`}>
                <div className="pt-2 text-sm font-semibold">{day}</div>
                <textarea value={data.schedule[day]} onChange={(event) => updateSchedule(day, event.target.value)} placeholder="إيه اللي هتنفذه النهارده" rows={2} className="planner-input resize-y" data-testid={`textarea-schedule-${day}`} />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6" data-testid="section-reflection">
          <h2 className="mb-1 text-[17px] font-bold">٣. التكيف اليومي — ملاحظات</h2>
          <p className="mb-2 text-[13px] text-muted-foreground">كل صبح راجع جدولك هنا: إيه اللي اتغير، إيه اللي محتاج ترتيب أولويات جديد.</p>
          <textarea value={data.reflection} onChange={(event) => void save({ ...data, reflection: event.target.value })} placeholder="ملاحظاتك اليومية..." rows={4} className="planner-input resize-y" data-testid="textarea-reflection" />
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground" data-testid="status-save">{status || 'بيتحفظ أول ما تكتب'}</span>
          <button type="button" onClick={resetAll} className="planner-button planner-button-danger inline-flex items-center gap-1.5" data-testid="button-reset-all"><RotateCcw className="size-3.5" />أسبوع جديد (مسح الكل)</button>
        </div>
      </div>
    </div>
  );
}

function PlannerHeader({ onReview }: { onReview: () => void }) {
  const { signOut } = useClerk();
  return (
    <div className="mb-6 flex items-start justify-between gap-3" data-testid="planner-header">
      <div>
        <h1 className="text-[22px] font-bold leading-tight" data-testid="text-planner-title">جدول التنظيم الأسبوعي — المربع الثاني</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="text-planner-subtitle">الأدوار ← الأهداف ← الجدول ← التكيف اليومي</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={onReview} className="planner-button whitespace-nowrap" data-testid="button-open-review">مراجعة الأسبوع</button>
        <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="planner-button inline-flex items-center gap-1.5 text-muted-foreground" data-testid="button-sign-out"><LogOut className="size-3.5" /><span className="hidden sm:inline">خروج</span></button>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <PlannerSkeleton />;
  return isSignedIn ? <PlannerPage /> : <Landing />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const nextUserId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) client.clear();
      previousUserId.current = nextUserId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#0f6e56',
    colorForeground: '#2c2c2a',
    colorMutedForeground: '#5f5e5a',
    colorDanger: '#a32d2d',
    colorBackground: '#faf9f6',
    colorInput: '#ffffff',
    colorInputForeground: '#2c2c2a',
    colorNeutral: '#d3d1c7',
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#faf9f6] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#2c2c2a] font-semibold',
    headerSubtitle: 'text-[#5f5e5a]',
    socialButtonsBlockButtonText: 'text-[#2c2c2a]',
    formFieldLabel: 'text-[#2c2c2a]',
    footerActionLink: 'text-[#0f6e56]',
    footerActionText: 'text-[#5f5e5a]',
    dividerText: 'text-[#5f5e5a]',
    identityPreviewEditButton: 'text-[#0f6e56]',
    formFieldSuccessText: 'text-[#27500a]',
    alertText: 'text-[#791f1f]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#d3d1c7] bg-white',
    formButtonPrimary: 'bg-[#0f6e56] hover:bg-[#0c5d49] text-white',
    formFieldInput: 'border-[#d3d1c7] bg-white text-[#2c2c2a]',
    footerAction: 'border-t border-[#e5e3da]',
    dividerLine: 'bg-[#e5e3da]',
    alert: 'bg-[#fcebeb] border-[#e3a9a9]',
    otpCodeFieldInput: 'border-[#d3d1c7] bg-white',
    formFieldRow: 'text-[#2c2c2a]',
    main: 'bg-transparent',
  },
};

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'أهلاً بيك تاني', subtitle: 'سجل دخولك عشان تفتح جدولك' } },
        signUp: { start: { title: 'اعمل حسابك', subtitle: 'ابدأ تخطيط أسبوعك النهارده' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;