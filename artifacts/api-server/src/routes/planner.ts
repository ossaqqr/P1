import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  AnalyzePlannerReviewBody,
  GetPlannerDataResponse,
  SavePlannerDataBody,
  SavePlannerDataResponse,
  AnalyzePlannerReviewResponse,
} from "@workspace/api-zod";
import { db, plannerDataTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { migrateLegacyPlannerData } from "../lib/legacyMigration";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};

const defaultPlannerData = () => ({
  weekEndDate: "",
  roles: Array.from({ length: 4 }, (_, index) => ({
    id: `role-${index + 1}`,
    name: "",
    goal1: "",
    goal2: "",
  })),
  schedule: {
    السبت: "",
    الأحد: "",
    الاثنين: "",
    الثلاثاء: "",
    الأربعاء: "",
    الخميس: "",
    الجمعة: "",
  },
  reflection: "",
  review: null,
});

router.get("/planner/data", requireAuth, async (req, res) => {
  try {
    const userId = res.locals.userId as string;
    await migrateLegacyPlannerData(userId, req.log);
    const existing = await db
      .select()
      .from(plannerDataTable)
      .where(eq(plannerDataTable.userId, userId))
      .limit(1);
    const data = GetPlannerDataResponse.parse(
      existing[0]?.data ?? defaultPlannerData(),
    );
    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "Failed to load planner data");
    res.status(500).json({ error: "Failed to load planner data" });
  }
});

router.put("/planner/data", requireAuth, async (req, res) => {
  try {
    const userId = res.locals.userId as string;
    const data = SavePlannerDataBody.parse(req.body);
    const [saved] = await db
      .insert(plannerDataTable)
      .values({ userId, data })
      .onConflictDoUpdate({
        target: plannerDataTable.userId,
        set: { data, updatedAt: new Date() },
      })
      .returning();
    const response = SavePlannerDataResponse.parse(saved.data);
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Failed to save planner data");
    res.status(400).json({ error: "Failed to save planner data" });
  }
});

router.post("/planner/analyze", requireAuth, async (req, res) => {
  try {
    const { entries } = AnalyzePlannerReviewBody.parse(req.body);
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: CONCEPT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(entries) }],
      }),
    });

    const payload = (await upstream.json()) as {
      error?: { message?: string };
      content?: Array<{ type: string; text?: string }>;
    };
    if (!upstream.ok || payload.error) {
      throw new Error(payload.error?.message || "Anthropic API request failed");
    }

    const rawText = (payload.content ?? [])
      .map((block) => (block.type === "text" ? block.text ?? "" : ""))
      .join("\n")
      .trim();
    if (!rawText) throw new Error("Anthropic returned an empty response");

    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const candidate = jsonMatch ? jsonMatch[0] : cleaned;
    const parsed = AnalyzePlannerReviewResponse.parse(JSON.parse(candidate));
    if (parsed.items.length !== entries.length) {
      throw new Error("Analysis item count did not match goal count");
    }
    res.json(parsed);
  } catch (error) {
    req.log.error({ err: error }, "Failed to analyze planner review");
    res.status(502).json({ error: "Failed to analyze the weekly review" });
  }
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

export default router;