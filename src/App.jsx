import React, { useState, useEffect, useMemo, useCallback } from "react";

const PAGE_BG = "#FAF8F3";
const SURFACE = "#FFFFFF";
const NAVY = "#141C30";
const NAVY_SOFT = "#1F2A47";
const GOLD = "#A9821A";
const GOLD_BRIGHT = "#E0BC4A";
const GOLD_FILL = "#C9A227";
const GOLD_DIM = "#D9CB9C";
const TEXT = "#20242F";
const MUTED = "#6E7280";
const LINE = "#E4E0D2";
const DISABLED_BG = "#F1EFE6";
const DISABLED_TEXT = "#B7B2A2";

const ZODIAC = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"];
const MATTERS = ["收驚", "家運", "事業", "身體", "學業", "運途", "姻緣", "財運", "其他"];
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MAX_DAILY = 15;
const BLOCKED_SLOTS = ["20:00", "20:15"];
const QUEUE_OFFSET = BLOCKED_SLOTS.length;
const ADMIN_CODE = "0000"; // 僅作為前台登入畫面的初步檢查，真正的權限驗證在 Google Apps Script 後端

// ⚠️ 部署 Google Apps Script 後，把取得的網址貼在這裡（見 README.md 的教學）
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQXnx24XIca6K0PcMx2ud6iUo-Qq3k-BPTFiSsKngZzxEiAUYMlHtDmtwBNwKmDhZy/exec";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function generateSlots() {
  const slots = [];
  for (let h = 20; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return slots;
}
const ALL_SLOTS = generateSlots();

function zigzagClipPath(width, height, teeth, edge) {
  const step = width / teeth;
  const points = [];
  if (edge === "top" || edge === "both") {
    points.push("0px 8px");
    for (let i = 0; i <= teeth; i++) {
      const x = i * step;
      points.push(`${x}px ${i % 2 === 0 ? 0 : 8}px`);
    }
  } else {
    points.push("0px 0px");
    points.push(`${width}px 0px`);
  }
  points.push(`${width}px ${edge === "bottom" || edge === "both" ? height - 8 : height}px`);
  if (edge === "bottom" || edge === "both") {
    for (let i = teeth; i >= 0; i--) {
      const x = i * step;
      points.push(`${x}px ${height - (i % 2 === 0 ? 0 : 8)}px`);
    }
  } else {
    points.push(`0px ${height}px`);
  }
  return `polygon(${points.join(",")})`;
}

function useSharedSlots(dateKey) {
  const [booked, setBooked] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!dateKey) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${APPS_SCRIPT_URL}?action=slots&date=${encodeURIComponent(dateKey)}&_ts=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setBooked(data.booked || []);
    } catch (e) {
      setBooked([]);
    }
    setLoading(false);
  }, [dateKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { booked, loading, reload };
}

export default function TempleBookingPage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [step, setStep] = useState("notice");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    calendarType: "國曆",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    zodiac: "",
    matter: "",
    note: "",
  });

  const dateKey = selectedDate ? toDateKey(selectedDate.y, selectedDate.m, selectedDate.d) : null;
  const { booked, loading: slotsLoading, reload } = useSharedSlots(dateKey);

  const monthMatrix = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewYear, viewMonth]);

  function isPast(y, m, d) {
    const dt = new Date(y, m, d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime() < today.getTime();
  }

  function isFriday(y, m, d) {
    return new Date(y, m, d).getDay() === 5;
  }

  function handlePickDate(d) {
    if (!d) return;
    if (isPast(viewYear, viewMonth, d) || !isFriday(viewYear, viewMonth, d)) return;
    setSelectedDate({ y: viewYear, m: viewMonth, d });
    setSelectedTime(null);
    setStep("slots");
    setError("");
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }
  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const bookedTimes = useMemo(() => (booked ? booked.map((b) => b.time) : []), [booked]);
  const dailyFull = bookedTimes.length >= MAX_DAILY;

  function pickTime(t) {
    if (bookedTimes.includes(t) || BLOCKED_SLOTS.includes(t) || dailyFull) return;
    setSelectedTime(t);
    setStep("form");
    setError("");
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) return setError("請填寫問事者姓名");
    if (!form.address.trim()) return setError("請填寫住址");
    if (!form.birthYear || !form.birthMonth || !form.birthDay) return setError("請完整填寫出生年月日");
    if (!form.zodiac) return setError("請選擇生肖");
    if (!form.matter) return setError("請選擇想詢問的事項");

    setSubmitting(true);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // 避免觸發瀏覽器 CORS 預檢請求
        body: JSON.stringify({
          action: "book",
          ...form,
          date: dateKey,
          time: selectedTime,
        }),
      });
      const data = await res.json();

      if (data.error === "full") {
        setError("本日預約名額已額滿，請選擇其他週五時段");
        setSubmitting(false);
        await reload();
        setStep("slots");
        return;
      }
      if (data.error === "slot_taken") {
        setError("此時段剛被其他人預約，請重新選擇時段");
        setSubmitting(false);
        await reload();
        setStep("slots");
        return;
      }
      if (!data.success) throw new Error("儲存失敗");

      const record = {
        ...form,
        date: dateKey,
        time: selectedTime,
        queue: data.queue,
        createdAt: new Date().toISOString(),
      };

      setTicket(record);
      setStep("done");
    } catch (err) {
      console.error("booking error:", err);
      setError(`預約時發生問題：${err && err.message ? err.message : "請再試一次"}`);
    }
    setSubmitting(false);
  }

  function resetAll() {
    setSelectedDate(null);
    setSelectedTime(null);
    setStep("calendar");
    setTicket(null);
    setError("");
    setForm({
      name: "",
      address: "",
      calendarType: "國曆",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
      zodiac: "",
      matter: "",
      note: "",
    });
  }

  const yearOptions = [];
  for (let y = today.getFullYear(); y >= 1920; y--) yearOptions.push(y);

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, fontFamily: '"Noto Serif TC","PMingLiU","微軟正黑體",serif', color: TEXT }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
        <Hero />

        {step !== "done" && step !== "notice" && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "28px 0 8px", fontSize: 13, color: MUTED, letterSpacing: 1 }}>
            <StepDot active={step === "calendar"} label="選日期" />
            <span>—</span>
            <StepDot active={step === "slots"} label="選時段" />
            <span>—</span>
            <StepDot active={step === "form"} label="填資料" />
          </div>
        )}

        {step === "notice" && <NoticeView onProceed={() => setStep("calendar")} />}

        {step === "calendar" && (
          <CalendarView
            viewYear={viewYear}
            viewMonth={viewMonth}
            monthMatrix={monthMatrix}
            onPrev={prevMonth}
            onNext={nextMonth}
            onPick={handlePickDate}
            isPast={isPast}
            isFriday={isFriday}
          />
        )}

        {step === "slots" && selectedDate && (
          <SlotsView
            dateKey={dateKey}
            slots={ALL_SLOTS}
            bookedTimes={bookedTimes}
            loading={slotsLoading}
            onPick={pickTime}
            onBack={() => setStep("calendar")}
            dailyFull={dailyFull}
          />
        )}

        {step === "form" && (
          <FormView
            dateKey={dateKey}
            time={selectedTime}
            form={form}
            updateField={updateField}
            onSubmit={handleSubmit}
            onBack={() => setStep("slots")}
            submitting={submitting}
            error={error}
            yearOptions={yearOptions}
          />
        )}

        {step === "done" && ticket && <TicketView ticket={ticket} onReset={resetAll} />}

        {step === "admin" && <AdminView onExit={() => setStep("notice")} />}

        <Footer />

        {step !== "admin" && (
          <p style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => setStep("admin")}
              style={{ background: "none", border: "none", color: MUTED, fontSize: 11, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
            >
              管理者專用：取消預約
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <p style={{ fontSize: 12, color: MUTED, textAlign: "center", letterSpacing: 2, marginTop: 48 }}>彰化玄武真慶宮</p>
  );
}

function AdminView({ onExit }) {
  const [authed, setAuthed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [pickedDate, setPickedDate] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [bookings, setBookings] = useState(null);
  const [loading, setLoading] = useState(false);

  const dateKey = pickedDate ? toDateKey(pickedDate.y, pickedDate.m, pickedDate.d) : null;

  const loadBookings = useCallback(async () => {
    if (!dateKey || !adminCode) return;
    setLoading(true);

    async function fetchOnce() {
      const res = await fetch(
        `${APPS_SCRIPT_URL}?action=admin_list&date=${encodeURIComponent(dateKey)}&code=${encodeURIComponent(
          adminCode
        )}&_ts=${Date.now()}`, // 加上時間戳記避免瀏覽器或 Google 端快取到舊的回應
        { cache: "no-store" }
      );
      return res.json();
    }

    try {
      let data = await fetchOnce();
      if (data.error === "unauthorized") {
        // 可能是暫時性的快取回應，先自動重試一次，不要立刻踢回登入畫面
        data = await fetchOnce();
      }
      if (data.error === "unauthorized") {
        setCodeError("密碼錯誤，請重新輸入");
        setAuthed(false);
        setBookings(null);
      } else {
        setCodeError("");
        setBookings(data.bookings || []);
      }
    } catch (e) {
      setBookings([]);
    }
    setLoading(false);
  }, [dateKey, adminCode]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const monthMatrix = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewYear, viewMonth]);

  function isFriday(y, m, d) {
    return new Date(y, m, d).getDay() === 5;
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }
  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function checkCode(e) {
    e.preventDefault();
    // 實際密碼是否正確，交由後端 admin_list 呼叫驗證（見上方 loadBookings）
    setAdminCode(codeInput);
    setAuthed(true);
    setCodeError("");
  }

  async function cancelBooking(time) {
    setActionMsg("");
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "cancel", date: dateKey, time, code: adminCode }),
      });
      const data = await res.json();
      if (data.error === "unauthorized") {
        setActionMsg("密碼錯誤，無法取消");
        return;
      }
      if (data.error === "not_found") {
        setActionMsg("找不到此筆預約");
        return;
      }
      setActionMsg(`已取消 ${time} 的預約，該時段將重新開放`);
      await loadBookings();
    } catch (err) {
      setActionMsg("取消失敗，請再試一次");
    }
  }

  if (!authed) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>管理者登入</div>
        <form onSubmit={checkCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            style={inputStyle}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="請輸入管理密碼"
          />
          {codeError && <div style={{ color: "#B23A3A", fontSize: 13 }}>{codeError}</div>}
          <button type="submit" style={primaryBtnStyle}>登入</button>
        </form>
        <button onClick={onExit} style={{ ...navBtnStyle, marginTop: 16 }}>返回預約頁面</button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>管理者：取消預約</div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prevMonth} style={navBtnStyle}>‹ 上個月</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{viewYear} 年 {viewMonth + 1} 月</div>
        <button onClick={nextMonth} style={navBtnStyle}>下個月 ›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 12, color: w === "五" ? GOLD : MUTED }}>{w}</div>
        ))}
      </div>
      {monthMatrix.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
          {week.map((d, di) => {
            if (!d) return <div key={di} />;
            const friday = isFriday(viewYear, viewMonth, d);
            const isSelected = pickedDate && pickedDate.y === viewYear && pickedDate.m === viewMonth && pickedDate.d === d;
            return (
              <button
                key={di}
                onClick={() => friday && setPickedDate({ y: viewYear, m: viewMonth, d })}
                disabled={!friday}
                style={{
                  aspectRatio: "1",
                  border: isSelected ? `2px solid ${GOLD_FILL}` : friday ? `1px solid ${GOLD_FILL}` : `1px solid ${LINE}`,
                  borderRadius: 6,
                  background: friday ? SURFACE : DISABLED_BG,
                  color: friday ? (isSelected ? GOLD : TEXT) : DISABLED_TEXT,
                  cursor: friday ? "pointer" : "not-allowed",
                  fontSize: 13,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      ))}

      {pickedDate && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{dateKey}（週五）目前預約</div>
          {loading ? (
            <p style={{ color: MUTED, fontSize: 13 }}>載入中…</p>
          ) : bookings && bookings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bookings
                .slice()
                .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                .map((b) => (
                  <div
                    key={b.time}
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 6,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{b.time}　第 {b.queue} 號　{b.name}</span>
                      <button
                        onClick={() => cancelBooking(b.time)}
                        style={{ ...navBtnStyle, borderColor: "#C77", color: "#B23A3A", padding: "4px 10px", fontSize: 12 }}
                      >
                        取消此預約
                      </button>
                    </div>
                    <span style={{ fontSize: 12, color: MUTED }}>
                      {b.address}　·　{b.calendarType} {b.birthYear}-{b.birthMonth}-{b.birthDay}　·　{b.zodiac}　·　{b.matter}
                    </span>
                    {b.note && <span style={{ fontSize: 12, color: MUTED }}>備註：{b.note}</span>}
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ color: MUTED, fontSize: 13 }}>此日期目前尚無預約。</p>
          )}
          {actionMsg && <p style={{ fontSize: 13, color: GOLD, marginTop: 12 }}>{actionMsg}</p>}
        </div>
      )}

      <p style={{ fontSize: 12, color: MUTED, marginTop: 20, lineHeight: 1.8 }}>
        取消後，該時段會立刻重新開放給信眾預約。
      </p>

      <button onClick={onExit} style={{ ...navBtnStyle, marginTop: 20 }}>返回預約頁面</button>
    </div>
  );
}

function Hero() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        style={{
          background: `linear-gradient(180deg, ${NAVY_SOFT}, ${NAVY})`,
          borderRadius: 6,
          padding: "22px 16px",
          boxShadow: `0 0 0 2px ${GOLD_FILL} inset`,
          writingMode: "vertical-rl",
          fontSize: 30,
          fontWeight: 700,
          color: GOLD_BRIGHT,
          letterSpacing: 10,
          lineHeight: 1.4,
        }}
      >
        線上問事預約
      </div>
      <p style={{ fontSize: 14, color: MUTED, letterSpacing: 2, margin: 0 }}>每週五晚間 20:00 開放預約問事</p>
    </div>
  );
}

function StepDot({ active, label }) {
  return (
    <span style={{ color: active ? GOLD : MUTED, fontWeight: active ? 700 : 400 }}>{label}</span>
  );
}

function NoticeView({ onProceed }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, letterSpacing: 3, marginBottom: 18, textAlign: "center" }}>
        預約須知
      </div>
      <p style={{ fontSize: 14, lineHeight: 2, color: TEXT, margin: "0 0 16px" }}>
        親愛的善信大德您好，本宮濟世日開放信眾問事時間為每周五的晚間 8:00 開始，為了維護您的權益，以下有幾件注意事項需麻煩您留意：
      </p>
      <div style={{ margin: "0 0 16px" }}>
        <NoticeItem number={1}>當日預約名額以 15 位為上限，如有需求請提早做預約。</NoticeItem>
        <NoticeItem number={2}>
          如有任何問題，可先至官方社群平台（LINE/FB）私訊小編，但請注意基本禮儀，因粉專目前無專人服務，因此小編將會於收到訊息後
          <strong style={{ color: GOLD }}>2 個工作天內依照收到順序回覆您</strong>。
        </NoticeItem>
        <NoticeItem number={3}>官方社群平台將會公布當月開放預約日期，再請參照後再行預約。</NoticeItem>
        <NoticeItem number={4}>只要社群平台公開濟世日時間即可開始預約。</NoticeItem>
        <NoticeItem number={5}>如有急需請在預約前向小編尋求協助，小編將會替您再做協調及溝通。</NoticeItem>
      </div>
      <p style={{ fontSize: 14, lineHeight: 2, color: TEXT, margin: "0 0 24px" }}>感謝您的配合</p>
      <button onClick={onProceed} style={primaryBtnStyle}>我已閱讀並了解，開始預約</button>
    </div>
  );
}

function NoticeItem({ number, children }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
      <span
        style={{
          flex: "0 0 auto",
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `1px solid ${GOLD_FILL}`,
          color: GOLD,
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 3,
        }}
      >
        {number}
      </span>
      <span style={{ fontSize: 14, lineHeight: 2, color: TEXT }}>{children}</span>
    </div>
  );
}

function CalendarView({ viewYear, viewMonth, monthMatrix, onPrev, onNext, onPick, isPast, isFriday }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onPrev} style={navBtnStyle}>‹ 上個月</button>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: NAVY }}>{viewYear} 年 {viewMonth + 1} 月</div>
        <button onClick={onNext} style={navBtnStyle}>下個月 ›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 13, color: w === "五" ? GOLD : MUTED, fontWeight: w === "五" ? 700 : 400, padding: "4px 0" }}>
            {w}
          </div>
        ))}
      </div>
      {monthMatrix.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
          {week.map((d, di) => {
            if (!d) return <div key={di} />;
            const past = isPast(viewYear, viewMonth, d);
            const friday = isFriday(viewYear, viewMonth, d);
            const disabled = past || !friday;
            return (
              <button
                key={di}
                onClick={() => onPick(d)}
                disabled={disabled}
                style={{
                  aspectRatio: "1",
                  border: friday && !past ? `1px solid ${GOLD_FILL}` : `1px solid ${LINE}`,
                  borderRadius: 6,
                  background: disabled ? DISABLED_BG : SURFACE,
                  color: disabled ? DISABLED_TEXT : friday ? GOLD : TEXT,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: friday ? 700 : 400,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      ))}
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12, textAlign: "center" }}>僅開放週五（金框標示日期），其餘日期無法預約</p>
    </div>
  );
}

function SlotsView({ dateKey, slots, bookedTimes, loading, onPick, onBack, dailyFull }) {
  return (
    <div style={cardStyle}>
      <button onClick={onBack} style={{ ...navBtnStyle, marginBottom: 16 }}>‹ 重新選擇日期</button>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: NAVY }}>{dateKey}（週五）</div>
      <p style={{ fontSize: 13, color: MUTED, marginTop: 0, marginBottom: 16 }}>
        當日預約名額以 {MAX_DAILY} 位為上限。已被預約的時段將反白顯示，無法點選。此頁面的時段狀態為公開共享資訊，會顯示給所有使用者，但您填寫的個人資料僅保留在您自己的裝置上。
      </p>
      {dailyFull && (
        <div style={{ padding: "10px 14px", borderRadius: 6, border: `1px solid ${GOLD_DIM}`, background: "#FBF6E6", color: GOLD, fontSize: 13, marginBottom: 16 }}>
          本日預約名額已額滿，請選擇其他週五日期。
        </div>
      )}
      {loading ? (
        <p style={{ color: MUTED }}>載入時段中…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {slots.map((t) => {
            const isBooked = bookedTimes.includes(t) || BLOCKED_SLOTS.includes(t) || dailyFull;
            return (
              <button
                key={t}
                onClick={() => onPick(t)}
                disabled={isBooked}
                style={{
                  padding: "10px 4px",
                  borderRadius: 6,
                  border: `1px solid ${isBooked ? LINE : GOLD_FILL}`,
                  background: isBooked ? DISABLED_BG : SURFACE,
                  color: isBooked ? DISABLED_TEXT : TEXT,
                  fontSize: 13,
                  cursor: isBooked ? "not-allowed" : "pointer",
                  textDecoration: isBooked ? "line-through" : "none",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormView({ dateKey, time, form, updateField, onSubmit, onBack, submitting, error, yearOptions }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div style={cardStyle}>
      <button type="button" onClick={onBack} style={{ ...navBtnStyle, marginBottom: 16 }}>‹ 重新選擇時段</button>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: NAVY }}>{dateKey} {time} 預約資料填寫</div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="問事者姓名">
          <input style={inputStyle} value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="請輸入姓名" />
        </Field>

        <Field label="住址">
          <input style={inputStyle} value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="請輸入住址" />
        </Field>

        <Field label="出生年月日">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, flex: "0 0 90px" }} value={form.calendarType} onChange={(e) => updateField("calendarType", e.target.value)}>
              <option value="國曆">國曆</option>
              <option value="農曆">農曆</option>
            </select>
            <select style={{ ...inputStyle, flex: "1 1 90px" }} value={form.birthYear} onChange={(e) => updateField("birthYear", e.target.value)}>
              <option value="">年</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select style={{ ...inputStyle, flex: "1 1 70px" }} value={form.birthMonth} onChange={(e) => updateField("birthMonth", e.target.value)}>
              <option value="">月</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select style={{ ...inputStyle, flex: "1 1 70px" }} value={form.birthDay} onChange={(e) => updateField("birthDay", e.target.value)}>
              <option value="">日</option>
              {days.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="生肖">
          <select style={inputStyle} value={form.zodiac} onChange={(e) => updateField("zodiac", e.target.value)}>
            <option value="">請選擇生肖</option>
            {ZODIAC.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </Field>

        <Field label="想詢問的事項">
          <select style={inputStyle} value={form.matter} onChange={(e) => updateField("matter", e.target.value)}>
            <option value="">請選擇事項</option>
            {MATTERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>

        <Field label="備註（非必填）">
          <textarea
            style={{ ...inputStyle, height: 80, resize: "vertical", fontFamily: "inherit" }}
            value={form.note}
            onChange={(e) => updateField("note", e.target.value)}
            placeholder="可詳述問事內容或提出問題"
          />
        </Field>

        {error && <div style={{ color: "#B23A3A", fontSize: 13 }}>{error}</div>}

        <button type="submit" disabled={submitting} style={{ ...primaryBtnStyle, cursor: submitting ? "wait" : "pointer" }}>
          {submitting ? "送出中…" : "確認預約"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function TicketView({ ticket, onReset }) {
  const width = 400;
  const height = 240;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div
        style={{
          width,
          height,
          background: `linear-gradient(180deg, ${NAVY_SOFT}, ${NAVY})`,
          clipPath: zigzagClipPath(width, height, 14, "both"),
          border: `1px solid ${GOLD_FILL}`,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 28,
            width: 60,
            height: 60,
            borderRadius: 6,
            border: `2px solid ${GOLD_FILL}`,
            color: GOLD_BRIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            transform: "rotate(-8deg)",
            writingMode: "vertical-rl",
            opacity: 0.9,
          }}
        >
          已確認
        </div>
        <div style={{ fontSize: 13, color: "#A9B0C4", letterSpacing: 3 }}>號 碼 牌</div>
        <div style={{ fontSize: 56, fontWeight: 700, color: GOLD_BRIGHT, lineHeight: 1 }}>{ticket.queue}</div>
        <div style={{ fontSize: 14, color: "#EDE6D3", marginTop: 8 }}>{ticket.date}（週五）{ticket.time}</div>
        <div style={{ fontSize: 13, color: "#A9B0C4" }}>{ticket.name} · {ticket.matter}</div>
      </div>
      <p style={{ fontSize: 13, color: MUTED, textAlign: "center", maxWidth: 360 }}>
        預約完成，請於當日時段準時報到。此號碼牌與您填寫的資料已保存於您目前使用的裝置。
      </p>
      <button onClick={onReset} style={navBtnStyle}>再預約一筆</button>
    </div>
  );
}

const cardStyle = {
  background: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  padding: 24,
  boxShadow: "0 1px 3px rgba(20,28,48,0.06)",
};

const navBtnStyle = {
  background: "transparent",
  border: `1px solid ${GOLD_DIM}`,
  color: GOLD,
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtnStyle = {
  width: "100%",
  marginTop: 8,
  padding: "14px 0",
  borderRadius: 6,
  border: `1px solid ${GOLD_FILL}`,
  background: GOLD_FILL,
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 2,
  cursor: "pointer",
  fontFamily: "inherit",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${LINE}`,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  background: SURFACE,
  color: TEXT,
};
