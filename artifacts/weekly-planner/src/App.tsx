import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetMissionQueryKey,
  getGetPlannerDataQueryKey,
  getGetWeekPlanQueryKey,
  getListRolesQueryKey,
  setAuthTokenGetter,
  useAnalyzePlannerReview,
  useCreateGoal,
  useCreateRole,
  useCreateTask,
  useDeleteGoal,
  useDeleteTask,
  useGetMission,
  useGetPlannerData,
  useGetWeekPlan,
  useListRoles,
  useSaveMission,
  useSavePlannerData,
  useUpdateGoal,
  useUpdateRole,
  useUpdateTask,
  type LifeRole,
  type PlannerData,
  type ReviewAnalysisEntry,
  type Task as PlanTask,
  type WeeklyGoal,
} from '@workspace/api-client-react';
import { CalendarDays, Check, ChevronLeft, ClipboardList, LogOut, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Redirect, Route, Router as WouterRouter, Switch, Link, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as const;
type Day = (typeof DAYS)[number];
type ReviewFormEntry = {
  goalId: string;
  roleId: string;
  roleName: string;
  goalText: string;
  statusVal: string;
  reason: string;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function defaultData(): PlannerData {
  return {
    weekEndDate: '',
    roles: [],
    schedule: Object.fromEntries(DAYS.map((day) => [day, ''])) as unknown as PlannerData['schedule'],
    reflection: '',
    review: null,
  };
}

function normalizeData(value?: PlannerData | null): PlannerData {
  if (!value) return defaultData();
  return {
    ...value,
    roles: value.roles ?? [],
    schedule: Object.fromEntries(DAYS.map((day) => [day, value.schedule?.[day] ?? ''])) as unknown as PlannerData['schedule'],
    review: value.review ?? null,
  };
}

/** The Saturday that starts the week containing/ending on `weekEndDate`. */
function computeWeekStartDate(weekEndDate: string): string {
  if (!weekEndDate) return '';
  const end = new Date(`${weekEndDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return '';
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());

  const rolesQuery = useListRoles({ query: { queryKey: getListRolesQueryKey() } });
  const activeRoles = useMemo(() => (rolesQuery.data ?? []).filter((role) => role.isActive), [rolesQuery.data]);

  const weekStartDate = useMemo(() => computeWeekStartDate(data.weekEndDate), [data.weekEndDate]);
  const weekPlanQuery = useGetWeekPlan(weekStartDate, {
    query: { enabled: Boolean(weekStartDate), queryKey: getGetWeekPlanQueryKey(weekStartDate) },
  });
  const invalidateWeekPlan = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getGetWeekPlanQueryKey(weekStartDate) }),
    [queryClient, weekStartDate],
  );
  const createGoalMutation = useCreateGoal({ mutation: { onSuccess: () => void invalidateWeekPlan() } });
  const updateGoalMutation = useUpdateGoal({ mutation: { onSuccess: () => void invalidateWeekPlan() } });
  const deleteGoalMutation = useDeleteGoal({ mutation: { onSuccess: () => void invalidateWeekPlan() } });
  const createTaskMutation = useCreateTask({ mutation: { onSuccess: () => void invalidateWeekPlan() } });
  const updateTaskMutation = useUpdateTask({ mutation: { onSuccess: () => void invalidateWeekPlan() } });
  const deleteTaskMutation = useDeleteTask({ mutation: { onSuccess: () => void invalidateWeekPlan() } });

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

  const selectWeekEndDate = (date: Date | undefined) => {
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    void save({ ...data, weekEndDate: iso });
    setIsDatePickerOpen(false);
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
    const roleNameById = new Map(activeRoles.map((role) => [role.id, role.name]));
    return (weekPlanQuery.data?.goals ?? [])
      .filter((goal) => roleNameById.has(goal.roleId))
      .map((goal) => ({
        goalId: goal.id,
        roleId: goal.roleId,
        roleName: roleNameById.get(goal.roleId) ?? '',
        goalText: goal.title,
      }));
  }, [weekPlanQuery.data, activeRoles]);

  const openReviewIntro = () => setScreen('reviewIntro');
  const startReview = () => {
    setReviewEntries(goalList.map((goal) => ({ ...goal, statusVal: '', reason: '' })));
    setAnalyzeError('');
    setScreen('reviewForm');
  };

  const updateEntry = (index: number, field: 'statusVal' | 'reason', value: string) => {
    setReviewEntries((previous) => previous.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  };

  const STATUS_MAP: Record<string, 'done' | 'partial' | 'not_started'> = { 'تم': 'done', 'جزئيًا': 'partial', 'لأ': 'not_started' };

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
        roleId: entry.roleId,
        roleName: entry.roleName,
        goalField: entry.goalId,
        goalText: entry.goalText,
        statusVal: entry.statusVal,
        reason: entry.reason,
        advice: result.items[index].advice,
        concept: result.items[index].concept,
      }));
      await Promise.all(
        reviewEntries.map((entry) =>
          updateGoalMutation.mutateAsync({ goalId: entry.goalId, data: { status: STATUS_MAP[entry.statusVal] ?? 'not_started' } }),
        ),
      );
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
    void save({ ...defaultData() });
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
              <div key={`${entry.roleId}-${entry.goalId}`} className="planner-card" data-testid={`card-review-entry-${index}`}>
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
        <PlannerHeader onReview={openReviewIntro} onMission={() => setMissionOpen(true)} onRoles={() => setRolesOpen(true)} />
        <MissionDialog open={missionOpen} onOpenChange={setMissionOpen} />
        <RolesDialog open={rolesOpen} onOpenChange={setRolesOpen} />
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
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="planner-button inline-flex items-center gap-1.5"
                data-testid="label-week-end-date"
              >
                {data.weekEndDate ? 'تغيير التاريخ' : 'حدد التاريخ'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0" data-testid="popover-week-end-date">
              <Calendar
                mode="single"
                dir="rtl"
                selected={data.weekEndDate ? new Date(`${data.weekEndDate}T00:00:00`) : undefined}
                onSelect={selectWeekEndDate}
                autoFocus
                data-testid="calendar-week-end-date"
              />
            </PopoverContent>
          </Popover>
        </div>

        <section className="mb-8" data-testid="section-roles">
          <h2 className="mb-1 text-[17px] font-bold">١. الأدوار وأهداف الأسبوع</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">الأهداف هنا مرتبطة بأدوارك المُدارة — لو عايز تضيف دور جديد، افتح "الأدوار" فوق.</p>

          {rolesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">بيتحمل...</p>
          ) : activeRoles.length === 0 ? (
            <div className="planner-card text-center" data-testid="empty-state-no-roles">
              <p className="mb-2.5 text-sm text-muted-foreground">لسه معندكش أي دور مفعّل.</p>
              <button type="button" onClick={() => setRolesOpen(true)} className="planner-button planner-button-primary" data-testid="button-add-first-role">افتح الأدوار وضيف واحد</button>
            </div>
          ) : !weekStartDate ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-state-no-week">حدد تاريخ نهاية الأسبوع فوق الأول عشان تقدر تحط أهدافك.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeRoles.map((role) => (
                <RoleGoalsCard
                  key={role.id}
                  role={role}
                  weekStartDate={weekStartDate}
                  goals={(weekPlanQuery.data?.goals ?? []).filter((g) => g.roleId === role.id)}
                  tasks={weekPlanQuery.data?.tasks ?? []}
                  onCreateGoal={(title) => createGoalMutation.mutate({ data: { roleId: role.id, weekStartDate, title } })}
                  onUpdateGoal={(goalId, title) => updateGoalMutation.mutate({ goalId, data: { title } })}
                  onDeleteGoal={(goalId) => deleteGoalMutation.mutate({ goalId })}
                  onCreateTask={(goalId, title) => createTaskMutation.mutate({ data: { goalId, title } })}
                  onToggleTask={(taskId, isDone) => updateTaskMutation.mutate({ taskId, data: { isDone } })}
                  onDeleteTask={(taskId) => deleteTaskMutation.mutate({ taskId })}
                />
              ))}
            </div>
          )}
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

function RoleGoalsCard({
  role,
  weekStartDate,
  goals,
  tasks,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
}: {
  role: LifeRole;
  weekStartDate: string;
  goals: WeeklyGoal[];
  tasks: PlanTask[];
  onCreateGoal: (title: string) => void;
  onUpdateGoal: (goalId: string, title: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onCreateTask: (goalId: string, title: string) => void;
  onToggleTask: (taskId: string, isDone: boolean) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const handleAdd = () => {
    if (!newGoalTitle.trim()) return;
    onCreateGoal(newGoalTitle.trim());
    setNewGoalTitle('');
  };

  return (
    <div className="planner-card" data-testid={`role-goals-card-${role.id}`}>
      <p className="mb-0.5 font-semibold" data-testid={`text-role-name-${role.id}`}>{role.name}</p>
      {role.description && <p className="mb-2 text-xs text-muted-foreground">{role.description}</p>}
      <div className="flex flex-col gap-2">
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            tasks={tasks.filter((task) => task.goalId === goal.id)}
            onUpdate={(title) => onUpdateGoal(goal.id, title)}
            onDelete={() => onDeleteGoal(goal.id)}
            onCreateTask={(title) => onCreateTask(goal.id, title)}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
      <div className="mt-2.5 flex gap-2" data-testid={`new-goal-row-${weekStartDate}-${role.id}`}>
        <input
          type="text"
          value={newGoalTitle}
          onChange={(event) => setNewGoalTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') handleAdd(); }}
          placeholder="هدف جديد لهذا الدور"
          className="planner-input flex-1"
          data-testid={`input-new-goal-${role.id}`}
        />
        <button type="button" onClick={handleAdd} className="planner-button" aria-label="ضيف هدف" data-testid={`button-add-goal-${role.id}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  tasks,
  onUpdate,
  onDelete,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
}: {
  goal: WeeklyGoal;
  tasks: PlanTask[];
  onUpdate: (title: string) => void;
  onDelete: () => void;
  onCreateTask: (title: string) => void;
  onToggleTask: (taskId: string, isDone: boolean) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [expanded, setExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => setTitle(goal.title), [goal.title]);

  const statusLabel = goal.status === 'done' ? 'تم' : goal.status === 'partial' ? 'جزئيًا' : '';
  const statusColor = goal.status === 'done' ? 'text-[#27500a]' : goal.status === 'partial' ? 'text-[#633806]' : 'text-muted-foreground';

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onCreateTask(newTaskTitle.trim());
    setNewTaskTitle('');
  };

  return (
    <div className="rounded-lg border border-border/60 p-2.5" data-testid={`goal-row-${goal.id}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-label="المهام" className="shrink-0 text-muted-foreground" data-testid={`button-expand-goal-${goal.id}`}>
          <ChevronLeft className={`size-4 transition-transform ${expanded ? '-rotate-90' : ''}`} />
        </button>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => { if (title.trim() && title.trim() !== goal.title) onUpdate(title.trim()); }}
          className="planner-input flex-1 text-sm"
          data-testid={`input-goal-title-${goal.id}`}
        />
        {statusLabel && <span className={`shrink-0 text-[11px] font-semibold ${statusColor}`} data-testid={`status-goal-${goal.id}`}>{statusLabel}</span>}
        <button type="button" onClick={onDelete} aria-label="حذف الهدف" className="shrink-0 text-destructive" data-testid={`button-delete-goal-${goal.id}`}>
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="mr-6 mt-2 flex flex-col gap-1.5" data-testid={`tasks-list-${goal.id}`}>
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2" data-testid={`task-row-${task.id}`}>
              <input type="checkbox" checked={task.isDone} onChange={(event) => onToggleTask(task.id, event.target.checked)} data-testid={`checkbox-task-${task.id}`} />
              <span className={`flex-1 text-sm ${task.isDone ? 'text-muted-foreground line-through' : ''}`} data-testid={`text-task-title-${task.id}`}>{task.title}</span>
              <button type="button" onClick={() => onDeleteTask(task.id)} aria-label="حذف المهمة" className="text-destructive" data-testid={`button-delete-task-${task.id}`}>
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleAddTask(); }}
              placeholder="مهمة جديدة"
              className="planner-input flex-1 text-xs"
              data-testid={`input-new-task-${goal.id}`}
            />
            <button type="button" onClick={handleAddTask} className="planner-button px-2 py-1 text-xs" aria-label="ضيف مهمة" data-testid={`button-add-task-${goal.id}`}>
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const rolesQuery = useListRoles({ query: { enabled: open, queryKey: getListRolesQueryKey() } });
  const queryClient = useQueryClient();
  const createRoleMutation = useCreateRole({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() }) },
  });
  const updateRoleMutation = useUpdateRole({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() }) },
  });
  const [newRoleName, setNewRoleName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const roles = rolesQuery.data ?? [];
  const activeRoles = roles.filter((r) => r.isActive);
  const inactiveRoles = roles.filter((r) => !r.isActive);

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    createRoleMutation.mutate({ data: { name: newRoleName.trim() } });
    setNewRoleName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] max-w-lg overflow-y-auto" data-testid="dialog-roles">
        <DialogHeader>
          <DialogTitle>الأدوار</DialogTitle>
          <DialogDescription>أدوارك في حياتك — دور معطّل بيختفي من التخطيط الأسبوعي لكن يفضل محفوظ.</DialogDescription>
        </DialogHeader>

        {rolesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">بيتحمل...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddRole(); }}
                placeholder="اسم دور جديد"
                className="planner-input flex-1"
                data-testid="input-new-role-name"
              />
              <Button onClick={handleAddRole} disabled={createRoleMutation.isPending} data-testid="button-add-role">
                <Plus className="size-4" /> ضيف
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {activeRoles.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  expanded={expandedId === role.id}
                  onToggleExpand={() => setExpandedId(expandedId === role.id ? null : role.id)}
                  onUpdate={(patch) => updateRoleMutation.mutate({ roleId: role.id, data: patch })}
                />
              ))}
            </div>

            {inactiveRoles.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">أدوار معطّلة</p>
                <div className="flex flex-col gap-2 opacity-60">
                  {inactiveRoles.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      expanded={expandedId === role.id}
                      onToggleExpand={() => setExpandedId(expandedId === role.id ? null : role.id)}
                      onUpdate={(patch) => updateRoleMutation.mutate({ roleId: role.id, data: patch })}
                    />
                  ))}
                </div>
              </div>
            )}

            {roles.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">لسه معندكش أي أدوار. ضيف أول دور فوق.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleRow({
  role,
  expanded,
  onToggleExpand,
  onUpdate,
}: {
  role: LifeRole;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: { name?: string; description?: string | null; direction?: string | null; isActive?: boolean }) => void;
}) {
  const [description, setDescription] = useState(role.description ?? '');
  const [direction, setDirection] = useState(role.direction ?? '');

  useEffect(() => {
    setDescription(role.description ?? '');
    setDirection(role.direction ?? '');
  }, [role.description, role.direction]);

  return (
    <div className="planner-card" data-testid={`role-row-${role.id}`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onToggleExpand} className="flex-1 text-right font-semibold" data-testid={`button-expand-role-${role.id}`}>
          {role.name}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ isActive: !role.isActive })}
          className="planner-button px-2 py-1 text-xs"
          data-testid={`button-toggle-active-${role.id}`}
        >
          {role.isActive ? 'تعطيل' : 'تفعيل'}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">وصف الدور</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => onUpdate({ description: description || null })}
              rows={2}
              placeholder="إيه طبيعة الدور ده في حياتك؟"
              data-testid={`input-role-description-${role.id}`}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">الاتجاه طويل المدى</Label>
            <Textarea
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              onBlur={() => onUpdate({ direction: direction || null })}
              rows={2}
              placeholder="إيه اللي عايز توصله في الدور ده على المدى الطويل؟"
              data-testid={`input-role-direction-${role.id}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MissionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const missionQuery = useGetMission({ query: { enabled: open, queryKey: getGetMissionQueryKey() } });
  const saveMissionMutation = useSaveMission();
  const [missionStatement, setMissionStatement] = useState('');
  const [principles, setPrinciples] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (missionQuery.data) {
      setMissionStatement(missionQuery.data.missionStatement);
      setPrinciples(missionQuery.data.principles);
    }
  }, [missionQuery.data]);

  const handleSave = () => {
    setSaved(false);
    saveMissionMutation.mutate(
      { data: { missionStatement, principles } },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto" data-testid="dialog-mission">
        <DialogHeader>
          <DialogTitle>رسالتي الشخصية</DialogTitle>
          <DialogDescription>القيم والاتجاه اللي بتحدد أولوياتك — ارجع لها كل ما تخطط أسبوعك.</DialogDescription>
        </DialogHeader>
        {missionQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">بيتحمل...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="mission-statement" className="mb-1.5 block text-xs text-muted-foreground">رسالة حياتك</Label>
              <Textarea
                id="mission-statement"
                value={missionStatement}
                onChange={(e) => setMissionStatement(e.target.value)}
                placeholder="إيه أهم حاجة عايز حياتك تقوم عليها؟"
                rows={4}
                data-testid="input-mission-statement"
              />
            </div>
            <div>
              <Label htmlFor="mission-principles" className="mb-1.5 block text-xs text-muted-foreground">مبادئك وقيمك</Label>
              <Textarea
                id="mission-principles"
                value={principles}
                onChange={(e) => setPrinciples(e.target.value)}
                placeholder="القيم اللي بتحكم قراراتك..."
                rows={4}
                data-testid="input-mission-principles"
              />
            </div>
          </div>
        )}
        <DialogFooter className="mt-2 flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">{saved ? 'اتحفظ' : ''}</span>
          <Button onClick={handleSave} disabled={saveMissionMutation.isPending} data-testid="button-save-mission">
            {saveMissionMutation.isPending ? 'بيتحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlannerHeader({ onReview, onMission, onRoles }: { onReview: () => void; onMission: () => void; onRoles: () => void }) {
  const { signOut } = useClerk();
  return (
    <div className="mb-6 flex items-start justify-between gap-3" data-testid="planner-header">
      <div>
        <h1 className="text-[22px] font-bold leading-tight" data-testid="text-planner-title">جدول التنظيم الأسبوعي — المربع الثاني</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="text-planner-subtitle">الأدوار ← الأهداف ← الجدول ← التكيف اليومي</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={onRoles} className="planner-button whitespace-nowrap" data-testid="button-open-roles">الأدوار</button>
        <button type="button" onClick={onMission} className="planner-button whitespace-nowrap" data-testid="button-open-mission">رسالتي الشخصية</button>
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

function ClerkAuthTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
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
        <ClerkAuthTokenBridge />
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