/**
 * 使用說明請見 README.md「後端設定教學」章節。
 * 這段程式碼要貼到 Google 試算表的「擴充功能 → Apps Script」編輯器裡，
 * 不是放進 React 專案內。
 */

const SHEET_NAME = "Bookings";
const MAX_DAILY = 15;
const BLOCKED_SLOTS = ["20:00", "20:15"];
const QUEUE_OFFSET = BLOCKED_SLOTS.length;
const ADMIN_CODE = "0000"; // 建議部署前先改成你自己的管理密碼

const HEADERS = [
  "timestamp", "date", "time", "queue",
  "name", "address", "calendarType", "birthYear", "birthMonth", "birthDay",
  "zodiac", "matter", "note", "status"
];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function getAllRows() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((row, idx) => {
    const obj = { _rowIndex: idx + 2 }; // 試算表實際列號（含表頭），取消時要用
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action;
  const rows = getAllRows();

  if (action === "slots") {
    const date = e.parameter.date;
    const forDate = rows.filter((r) => r.date === date && r.status !== "cancelled");
    const booked = forDate.map((r) => ({ time: r.time, queue: r.queue }));
    return jsonOutput({ booked });
  }

  if (action === "admin_list") {
    const code = e.parameter.code;
    if (code !== ADMIN_CODE) return jsonOutput({ error: "unauthorized" });
    const date = e.parameter.date;
    const forDate = rows.filter((r) => r.date === date && r.status !== "cancelled");
    return jsonOutput({ bookings: forDate });
  }

  return jsonOutput({ error: "unknown_action" });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if (action === "book") {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const rows = getAllRows();
      const forDate = rows.filter((r) => r.date === body.date && r.status !== "cancelled");

      if (forDate.length >= MAX_DAILY) {
        return jsonOutput({ error: "full" });
      }
      if (forDate.some((r) => r.time === body.time)) {
        return jsonOutput({ error: "slot_taken" });
      }

      const queueNumber = forDate.length + 1 + QUEUE_OFFSET;
      const queueLabel = String(queueNumber).padStart(2, "0");

      const sheet = getSheet();
      sheet.appendRow([
        new Date(),
        body.date,
        body.time,
        queueLabel,
        body.name || "",
        body.address || "",
        body.calendarType || "",
        body.birthYear || "",
        body.birthMonth || "",
        body.birthDay || "",
        body.zodiac || "",
        body.matter || "",
        body.note || "",
        "confirmed",
      ]);

      return jsonOutput({ success: true, queue: queueLabel });
    } finally {
      lock.releaseLock();
    }
  }

  if (action === "cancel") {
    if (body.code !== ADMIN_CODE) return jsonOutput({ error: "unauthorized" });

    const sheet = getSheet();
    const rows = getAllRows();
    const target = rows.find((r) => r.date === body.date && r.time === body.time && r.status !== "cancelled");

    if (!target) return jsonOutput({ error: "not_found" });

    const statusCol = HEADERS.indexOf("status") + 1;
    sheet.getRange(target._rowIndex, statusCol).setValue("cancelled");
    return jsonOutput({ success: true });
  }

  return jsonOutput({ error: "unknown_action" });
}
