import React, { useState, useEffect, useCallback } from "react";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

const STORAGE_KEY = "covey-q2-data";

const emptyRole = () => ({ id: crypto.randomUUID(), name: "", goal1: "", goal2: "" });

const defaultData = () => ({
  weekEndDate: "",
  roles: [emptyRole(), emptyRole(), emptyRole(), emptyRole()],
  schedule: Object.fromEntries(DAYS.map((d) => [d, ""])),
  reflection: "",
  review: null, // { entries: [...], analysis, concept, message, completedAt }
});

const CONCEPT_SYSTEM_PROMPT = `إنت بتفكر وبتحلل بعقلية ستيفن كوفي في كتابه "العادات السبع للناس الأكثر فعالية" ككل — مش بس بجزئية إدارة الوقت. يعني فكرك مبني على نفس الأسس اللي الكتاب كله واقف عليها:

- الأخلاق الشخصية (Character Ethic) قبل تقنيات الشخصية: التغيير الحقيقي بييجي من المبادئ والقيم الداخلية مش من حيل أو أساليب سريعة.
- الاستباقية (Habit 1): الشخص مسؤول عن ردة فعله واختياراته، مش بس ضحية الظروف اللي حواليه.
- البدء والنهاية في بالك (Habit 2): أي هدف أو دور المفروض يتقاس على أساس رسالة الشخص في حياته والقيم اللي هو مؤمن بيها، مش بس على أساس إنه اتعمل ولا لأ.
- الأهم قبل الملح (Habit 3) والتنظيم في المربع الثاني: الفرق بين العاجل والمهم، وخطورة إن حياة الشخص تتحكم فيها الأمور العاجلة على حساب الأمور المهمة (الأدوار، العلاقات، النمو الشخصي).
- التوازن بين الأدوار المختلفة في حياة الشخص، ومفهوم "حساب البنك العاطفي" في العلاقات (Emotional Bank Account) لو الموضوع مالو علاقة بالناس.
- المرونة والاعتماد على الذات المتنامي: أداة التخطيط خادمة للشخص مش سيدة عليه، ومفيش داعي للشعور بالذنب المفرط، لكن كمان مفيش تبرير دايم بدون مواجهة حقيقية للنفس.
- الفرق بين الجيل الثالث والرابع في إدارة الوقت: الجيل الثالث بيركز على قوائم ومهام وإحساس بالذنب لو حاجة ما اتعملتش؛ الجيل الرابع بيركز على المبادئ والعلاقات والنتائج طويلة المدى.
- مبدأ إن أكبر عدو للأفضل أحيانًا هو الجيد: القدرة على قول "لا" لحاجات كويسة عشان تحمي وقتك ومبادئك للأهم.

استخدم الإطار الفكري ده بالكامل وأنت بتحلل، اختار المفهوم أو المفاهيم الأنسب لحالة الشخص المحددة بدل ما تلزم نفسك بمفهوم واحد ثابت كل مرة. ممنوع تجيب نصايح من نظريات إنتاجية تانية أو من عندك بعيد عن روح الكتاب ده.

هتاخد قايمة بأدوار الشخص وأهدافه في أسبوع معين، مع حالة كل هدف (تم / جزئيًا / لأ) والسبب اللي كتبه لو موجود. المطلوب منك رد منفصل لكل هدف على حدة، مش فقرة واحدة مجمعة لكل حاجة مع بعض. كل رد المفروض:
- يعترف باختصار شديد (جملة واحدة بس) بموقف الهدف ده، من غير ما يكرر أو يشرح اللي الشخص كتبه أصلاً.
- يركز الاهتمام الأكبر على نصيحة عملية للأمام: إيه اللي ممكن يجربه أو يغيره الأسبوع الجاي عشان يحسن في النقطة دي تحديدًا، مبنية على مفهوم من إطار كوفي اللي فوق.
- خاطب الشخص مباشرة بصيغة المخاطب ("انت"، "جرب"، "حاول") مش بصيغة الغائب.
- حتى لو الهدف "تم"، ممكن كمان تقترح إزاي يبني على النجاح ده أو يثبته، بدل ما تكتفي بالإشادة بس.

ارجعلي JSON فقط، من غير أي نص تاني قبله أو بعده أو علامات كود، بالشكل ده بالظبط:
{"items": [{"advice": "رد منفصل من ٢ إلى ٣ جمل بالعامية المصرية لهدف واحد بس، فيه اعتراف قصير بالموقف ثم نصيحة عملية للأمام مبنية على مفهوم من الكتاب", "concept": "اسم المفهوم من الكتاب اللي النصيحة دي مبنية عليه"}], "message": "جملة تحفيزية عامة قصيرة واحدة عن الأسبوع ككل، بالعامية المصرية، بصيغة المخاطب المباشر (انت)"}
مهم: عدد العناصر في "items" لازم يساوي بالظبط عدد الأهداف اللي هبعتهملك، وبنفس ترتيبهم.`;

async function callClaude(entries) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: CONCEPT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(entries) }],
    }),
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error("الرد من الخادم مكنش JSON صالح");
  }

  if (data.error) {
    throw new Error(data.error.message || "خطأ من الـ API");
  }

  const rawText = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  if (!rawText) {
    throw new Error("الرد جه فاضي من غير نص");
  }

  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed.items) || !parsed.message) {
      throw new Error("الرد مكملش كل الحقول المطلوبة");
    }
    if (parsed.items.length !== entries.length) {
      throw new Error("عدد الردود مش مطابق لعدد الأهداف");
    }
    return parsed;
  } catch (e) {
    throw new Error("الرد مش JSON صالح: " + rawText.slice(0, 200));
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateArabic(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

function daysRemainingLabel(dateStr) {
  const diffMs = new Date(dateStr) - new Date(todayStr());
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days > 1) return `باقي ${days} أيام`;
  if (days === 1) return "باقي يوم واحد";
  if (days === 0) return "الأسبوع بيخلص النهاردة";
  return "الأسبوع خلص، تقدر تراجعه";
}

export default function WeeklyPlanner() {
  const [data, setData] = useState(defaultData());
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [screen, setScreen] = useState("plan"); // plan | reviewIntro | reviewForm | reviewResult
  const [reviewEntries, setReviewEntries] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  useEffect(() => {
    (async () => {
      let d = defaultData();
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (!parsed.roles || parsed.roles.length === 0) parsed.roles = [emptyRole()];
          d = parsed;
        }
      } catch (e) {
        // no saved data yet
      }
      setData(d);
      const weekOver = d.weekEndDate && d.weekEndDate < todayStr();
      if (weekOver && !d.review) {
        setScreen("reviewIntro");
      }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (next) => {
    setData(next);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next));
      setStatus("اتحفظ");
      setTimeout(() => setStatus(""), 1200);
    } catch (e) {
      setStatus("حصل خطأ في الحفظ");
    }
  }, []);

  if (!loaded) return null;

  const updateRole = (id, field, value) => {
    save({ ...data, roles: data.roles.map((r) => (r.id === id ? { ...r, [field]: value } : r)) });
  };

  const addRole = () => {
    if (data.roles.length >= 7) return;
    save({ ...data, roles: [...data.roles, emptyRole()] });
  };

  const removeRole = (id) => {
    save({ ...data, roles: data.roles.filter((r) => r.id !== id) });
  };

  const updateSchedule = (day, value) => {
    save({ ...data, schedule: { ...data.schedule, [day]: value } });
  };

  const resetAll = () => {
    if (window.confirm("تمسح كل حاجة وتبدأ أسبوع جديد؟")) {
      save(defaultData());
      setScreen("plan");
    }
  };

  const goalList = () => {
    const list = [];
    data.roles.forEach((r) => {
      if (!r.name.trim()) return;
      if (r.goal1.trim()) list.push({ roleId: r.id, roleName: r.name, goalField: "goal1", goalText: r.goal1 });
      if (r.goal2.trim()) list.push({ roleId: r.id, roleName: r.name, goalField: "goal2", goalText: r.goal2 });
    });
    return list;
  };

  const openReviewIntro = () => setScreen("reviewIntro");

  const startReview = () => {
    const goals = goalList();
    setReviewEntries(goals.map((g) => ({ ...g, statusVal: "", reason: "" })));
    setAnalyzeError("");
    setScreen("reviewForm");
  };

  const updateEntry = (idx, field, value) => {
    setReviewEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const submitReview = async () => {
    const missing = reviewEntries.some((e) => !e.statusVal);
    if (missing) {
      setAnalyzeError("حدد حالة كل هدف الأول (تم / جزئيًا / لأ)");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const result = await callClaude(
        reviewEntries.map((e) => ({
          role: e.roleName,
          goal: e.goalText,
          status: e.statusVal,
          reason: e.reason || null,
        }))
      );
      const combinedEntries = reviewEntries.map((e, i) => ({
        ...e,
        advice: result.items[i].advice,
        concept: result.items[i].concept,
      }));
      const nextData = {
        ...data,
        review: {
          entries: combinedEntries,
          message: result.message,
          completedAt: new Date().toISOString(),
        },
      };
      await save(nextData);
      setScreen("reviewResult");
    } catch (e) {
      setAnalyzeError("حصل خطأ في التحليل: " + (e.message || "جرب تاني."));
    } finally {
      setAnalyzing(false);
    }
  };

  const startNewWeekFromReview = () => {
    const carriedRoles = data.roles.map((r) => ({ ...r, id: crypto.randomUUID(), goal1: "", goal2: "" }));
    save({ ...defaultData(), roles: carriedRoles.length ? carriedRoles : [emptyRole()] });
    setScreen("plan");
  };

  // ---------- Screens ----------

  if (screen === "reviewIntro") {
    const hasGoals = goalList().length > 0;
    return (
      <div dir="rtl" style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "2rem 1.5rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {data.weekEndDate && data.weekEndDate < todayStr() ? "الأسبوع خلص" : "مراجعة الأسبوع"}
          </h2>
          <p style={{ fontSize: 14, color: "#5f5e5a", marginBottom: 20 }}>
            {hasGoals
              ? "تحب تراجع الأهداف اللي حطيتها وتشوف وصلت فين؟"
              : "معندكش أهداف مسجلة للأسبوع ده، ارجع للجدول وحدد أهدافك الأول."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {hasGoals && (
              <button onClick={startReview} style={{ ...btnStyle, background: "#0f6e56", color: "#fff", border: "none" }}>
                ابدأ المراجعة
              </button>
            )}
            <button onClick={() => setScreen("plan")} style={btnStyle}>
              {hasGoals ? "مش دلوقتي" : "رجوع للجدول"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "reviewForm") {
    return (
      <div dir="rtl" style={wrapStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>مراجعة الأسبوع</h2>
        <p style={{ fontSize: 13, color: "#5f5e5a", marginBottom: 16 }}>
          لكل هدف، حدد وصلت فين، ولو مكنش تم، تقدر (مش لازم) تقول ليه باختصار.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviewEntries.map((e, idx) => (
            <div key={idx} style={cardStyle}>
              <p style={{ fontSize: 13, color: "#5f5e5a", margin: "0 0 2px" }}>{e.roleName}</p>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>{e.goalText}</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[
                  ["تم", "تم"],
                  ["جزئيًا", "جزئيًا"],
                  ["لأ", "لأ"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => updateEntry(idx, "statusVal", val)}
                    style={{
                      ...btnStyle,
                      flex: 1,
                      background: e.statusVal === val ? "#0f6e56" : "transparent",
                      color: e.statusVal === val ? "#fff" : "#2c2c2a",
                      border: e.statusVal === val ? "none" : "1px solid #d3d1c7",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {e.statusVal && e.statusVal !== "تم" && (
                <textarea
                  value={e.reason}
                  onChange={(ev) => updateEntry(idx, "reason", ev.target.value)}
                  placeholder="ليه؟ (اختياري)"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              )}
            </div>
          ))}
        </div>

        {analyzeError && <p style={{ color: "#a32d2d", fontSize: 13, marginTop: 10 }}>{analyzeError}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={submitReview}
            disabled={analyzing}
            style={{ ...btnStyle, background: "#0f6e56", color: "#fff", border: "none", opacity: analyzing ? 0.6 : 1 }}
          >
            {analyzing ? "بيحلل..." : "اعرض التحليل"}
          </button>
          <button onClick={() => setScreen("plan")} disabled={analyzing} style={btnStyle}>
            رجوع
          </button>
        </div>
      </div>
    );
  }

  if (screen === "reviewResult" && data.review) {
    return (
      <div dir="rtl" style={wrapStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>نتيجة مراجعة الأسبوع</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {data.review.entries.map((e, idx) => (
            <div key={idx} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{e.roleName}</p>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "2px 0 0" }}>{e.goalText}</p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    background: e.statusVal === "تم" ? "#eaf3de" : e.statusVal === "جزئيًا" ? "#faeeda" : "#fcebeb",
                    color: e.statusVal === "تم" ? "#27500a" : e.statusVal === "جزئيًا" ? "#633806" : "#791f1f",
                  }}
                >
                  {e.statusVal}
                </span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, margin: "8px 0 4px" }}>{e.advice}</p>
              <p style={{ fontSize: 11, color: "#888780", margin: 0 }}>من الكتاب: {e.concept}</p>
            </div>
          ))}
        </div>

        <div style={{ ...cardStyle, background: "#eaf3de", border: "1px solid #c0dd97" }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, fontWeight: 600, color: "#27500a" }}>{data.review.message}</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setScreen("plan")} style={btnStyle}>
            رجوع للجدول
          </button>
          <button onClick={startNewWeekFromReview} style={{ ...btnStyle, color: "#0f6e56" }}>
            ابدأ أسبوع جديد
          </button>
        </div>
      </div>
    );
  }

  // ---------- Main plan screen ----------
  return (
    <div dir="rtl" style={wrapStyle}>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>جدول التنظيم الأسبوعي — المربع الثاني</h1>
          <p style={{ fontSize: 14, color: "#5f5e5a", margin: "4px 0 0" }}>
            الأدوار ← الأهداف ← الجدول ← التكيف اليومي
          </p>
        </div>
        <button onClick={openReviewIntro} style={{ ...btnStyle, whiteSpace: "nowrap" }}>
          مراجعة الأسبوع
        </button>
      </div>

      {data.review && (
        <div style={{ ...cardStyle, background: "#eaf3de", border: "1px solid #c0dd97", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#27500a" }}>الأسبوع ده اتراجع بالفعل</span>
          <button onClick={() => setScreen("reviewResult")} style={{ ...btnStyle, padding: "6px 10px" }}>
            شوف النتيجة
          </button>
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12, color: "#888780", margin: "0 0 2px" }}>تاريخ نهاية الأسبوع</p>
          {data.weekEndDate ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 2px" }}>{formatDateArabic(data.weekEndDate)}</p>
              <p style={{ fontSize: 12, color: "#5f5e5a", margin: 0 }}>{daysRemainingLabel(data.weekEndDate)}</p>
            </>
          ) : (
            <p style={{ fontSize: 14, color: "#5f5e5a", margin: 0 }}>حدد الأسبوع عشان تقدر تراجعه في وقته</p>
          )}
        </div>
        <label style={{ ...btnStyle, cursor: "pointer", position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {data.weekEndDate ? "تغيير التاريخ" : "حدد التاريخ"}
          <input
            type="date"
            value={data.weekEndDate}
            onChange={(e) => save({ ...data, weekEndDate: e.target.value })}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
        </label>
      </div>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>١. الأدوار وأهداف الأسبوع</h2>
        <p style={{ fontSize: 13, color: "#5f5e5a", marginBottom: 12 }}>
          اكتب أهم أدوارك في حياتك وحط هدف أو اتنين لكل دور لِلأسبوع ده.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.roles.map((role) => (
            <div key={role.id} style={cardStyle}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={role.name}
                  onChange={(e) => updateRole(role.id, "name", e.target.value)}
                  placeholder="اسم الدور (مثلاً: الأب، الطالب، الموظف)"
                  style={{ ...inputStyle, fontWeight: 600, flex: 1 }}
                />
                <button onClick={() => removeRole(role.id)} aria-label="حذف الدور" style={{ ...btnStyle, padding: "6px 10px", color: "#a32d2d" }}>
                  حذف
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="text"
                  value={role.goal1}
                  onChange={(e) => updateRole(role.id, "goal1", e.target.value)}
                  placeholder="هدف ١ لهذا الأسبوع"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={role.goal2}
                  onChange={(e) => updateRole(role.id, "goal2", e.target.value)}
                  placeholder="هدف ٢ (اختياري)"
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>

        {data.roles.length < 7 && (
          <button onClick={addRole} style={{ ...btnStyle, marginTop: 10 }}>
            + ضيف دور
          </button>
        )}
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>٢. جدول الأسبوع</h2>
        <p style={{ fontSize: 13, color: "#5f5e5a", marginBottom: 12 }}>حط الأهداف اللي فوق فعليًا في أيام محددة.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DAYS.map((day) => (
            <div key={day} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 10, alignItems: "start" }}>
              <div style={{ fontWeight: 600, fontSize: 14, paddingTop: 8 }}>{day}</div>
              <textarea
                value={data.schedule[day]}
                onChange={(e) => updateSchedule(day, e.target.value)}
                placeholder="إيه اللي هتنفذه النهارده"
                rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>٣. التكيف اليومي — ملاحظات</h2>
        <p style={{ fontSize: 13, color: "#5f5e5a", marginBottom: 8 }}>
          كل صبح راجع جدولك هنا: إيه اللي اتغير، إيه اللي محتاج ترتيب أولويات جديد.
        </p>
        <textarea
          value={data.reflection}
          onChange={(e) => save({ ...data, reflection: e.target.value })}
          placeholder="ملاحظاتك اليومية..."
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e3da", paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: "#888780" }}>{status || "بيتحفظ أول ما تكتب"}</span>
        <button onClick={resetAll} style={{ ...btnStyle, color: "#a32d2d" }}>
          أسبوع جديد (مسح الكل)
        </button>
      </div>
    </div>
  );
}

const wrapStyle = { fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "1.5rem", color: "#2c2c2a" };

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid #d3d1c7",
  borderRadius: 8,
  outline: "none",
  color: "#2c2c2a",
  background: "#fff",
};

const cardStyle = {
  border: "1px solid #e5e3da",
  borderRadius: 12,
  padding: 12,
  background: "#faf9f6",
};

const btnStyle = {
  background: "transparent",
  border: "1px solid #d3d1c7",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};
