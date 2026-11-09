(() => {
  const config = window.APP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    config.SUPABASE_URL.startsWith("https://") &&
    !config.SUPABASE_URL.includes("請填入") &&
    !config.SUPABASE_ANON_KEY.includes("請填入");
  const $ = (id) => document.getElementById(id);
  const fixedPlaces = ["市場全聯", "舊小象旁邊", "85度C/燒臘店對面", "夾娃娃機/洗衣店旁", "紀醫師前面"];
  const ADDRESS_MAP = {
    "市場全聯":"基隆市七堵區南興路106號",
    "舊小象旁邊":"基隆市七堵區崇信街13-7號",
    "85度C/燒臘店對面":"基隆市七堵區明德一路212號",
    "夾娃娃機/洗衣店旁":"基隆市七堵區自治北街10號",
    "紀醫師前面":"基隆市七堵區開元路85號",
    "全聯旁邊":"基隆市七堵區南興路106號",
    "舊小巷":"基隆市七堵區崇信街13-7號",
    "85度C":"基隆市七堵區明德一路212號",
    "洗衣店(燒臘店旁)":"基隆市七堵區自治北街10號",
    "全聯":"基隆市七堵區南興路106號",
    "舊小象":"基隆市七堵區崇信街13-7號",
    "夾娃娃機":"基隆市七堵區自治北街10號",
    "紀醫師":"基隆市七堵區開元路85號"
  };
  const getMapUrl = (row) => {
    if (row.location_type === "custom" && row.latitude != null && row.longitude != null) {
      return "https://www.google.com/maps?q=" + encodeURIComponent(row.latitude + "," + row.longitude);
    }
    const address = ADDRESS_MAP[row.location_name];
    return address ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address) : "";
  };
  let db = null;
  let user = null;
  let selectedPlace = "";
  let gps = null;
  let calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let selectedDate;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const formatLocalDate = (d) =>
    [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const localDate = () => formatLocalDate(new Date());
  selectedDate = localDate();
  const dateDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return formatLocalDate(d);
  };
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year,month,1).getDay();
    const daysInMonth = new Date(year,month+1,0).getDate();
    const today = localDate();
    $("calendarMonth").textContent = year + " 年 " + (month+1) + " 月";
    let cells = "";
    for (let i=0;i<firstWeekday;i++) cells += '<span class="calendar-empty" aria-hidden="true"></span>';
    for (let day=1;day<=daysInMonth;day++) {
      const date = formatLocalDate(new Date(year,month,day));
      const classes = ["calendar-day"];
      if (date === selectedDate) classes.push("selected");
      if (date === today) classes.push("today");
      cells += '<button type="button" class="'+classes.join(" ")+'" data-date="'+date+'" aria-pressed="'+(date===selectedDate)+'">'+day+'</button>';
    }
    $("calendarDays").innerHTML = cells;
    $("recordDate").value = selectedDate;
    $("selectedDateLabel").textContent = "已選擇：" + selectedDate;
  };
  const chooseCalendarDate = (date) => {
    selectedDate = date;
    const [year,month] = date.split("-").map(Number);
    calendarMonth = new Date(year,month-1,1);
    renderCalendar();
  };
  const setMessage = (id, message, ok=false) => {
    $(id).textContent = message || "";
    $(id).classList.toggle("success", !!ok);
  };
  const setSelectedPlace = (place) => {
    selectedPlace = place;
    gps = null;
    document.querySelectorAll(".location-choice").forEach(btn =>
      btn.classList.toggle("selected", btn.dataset.place === place));
    $("gpsStatus").textContent = place ? "已選擇固定地點，不會記錄 GPS。" : "固定地點不會記錄 GPS；只有選擇其他位置時才需要定位。";
    $("gpsCoordinates").classList.add("hidden");
    $("saveBtn").disabled = !place;
    $("saveBtn").textContent = place ? "確認停放地點" : "請先選擇停放地點";
  };
  const showApp = (sessionUser) => {
    user = sessionUser;
    $("authPanel").classList.toggle("hidden", !!user);
    $("appPanel").classList.toggle("hidden", !user);
    $("logoutBtn").classList.toggle("hidden", !user);
    if (user) {
      $("todayLabel").textContent = "今天 " + localDate();
      chooseCalendarDate(localDate());
      setSelectedPlace("");
      loadRecords();
    }
  };
  const getGps = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("這個瀏覽器不支援 GPS 定位。"));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy}),
      err => reject(new Error(err.code === 1 ? "尚未允許定位權限，請在 iPhone 設定或 Safari 網站設定中允許定位。" : "目前無法取得定位，請確認 GPS 已開啟並稍後重試。")),
      {enableHighAccuracy:true,timeout:20000,maximumAge:0}
    );
  });
  const auth = async (mode) => {
    const email = $("email").value.trim();
    const password = $("password").value;
    setMessage("authMessage", mode === "signup" ? "正在建立帳號…" : "登入中…");
    const result = mode === "signup"
      ? await db.auth.signUp({email,password})
      : await db.auth.signInWithPassword({email,password});
    if (result.error) throw result.error;
    if (mode === "signup" && !result.data.session) {
      setMessage("authMessage","帳號已建立。請先到 Email 收取驗證信，完成驗證後再登入。",true);
    } else {
      setMessage("authMessage",mode === "signup" ? "帳號建立成功。" : "登入成功。",true);
      showApp(result.data.user);
    }
  };
  const loadLatestParking = async () => {
    const {data,error} = await db.from("parking_records").select("*")
      .order("parked_at",{ascending:false})
      .order("created_at",{ascending:false})
      .limit(1);
    if (error) {
      $("latestParkingDate").textContent = "最近停放位置暫時無法讀取";
      $("latestParkingPlace").textContent = "請稍後重新整理";
      $("latestParkingMap").innerHTML = "";
      return;
    }
    const row = data && data[0];
    if (!row) {
      $("latestParkingDate").textContent = "目前尚無停放紀錄";
      $("latestParkingPlace").textContent = "還沒有紀錄";
      $("latestParkingMap").innerHTML = "";
      return;
    }
    const dateText = row.parked_at || "";
    const timeText = row.created_at
      ? new Date(row.created_at).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})
      : "";
    $("latestParkingDate").textContent = dateText + (timeText ? " · " + timeText : "");
    $("latestParkingPlace").textContent = row.location_name || "未標示地點";
    const latestMapUrl = getMapUrl(row);
    $("latestParkingMap").innerHTML = latestMapUrl
      ? '<a class="latest-map-link" target="_blank" rel="noopener" href="'+latestMapUrl+'">在地圖上開啟位置 ↗</a>'
      : "";
  };
  const loadRecords = async () => {
    loadLatestParking();
    $("recordList").innerHTML = '<div class="empty">載入中…</div>';
    const startDate = dateDaysAgo(6);
    const endDate = localDate();
    const query = db.from("parking_records").select("*")
      .gte("parked_at",startDate).lte("parked_at",endDate)
      .order("parked_at",{ascending:false}).order("created_at",{ascending:false});
    const {data,error} = await query.limit(200);
    if (error) {
      $("recordList").innerHTML = '<div class="empty">讀取失敗：'+escapeHtml(error.message)+'</div>';
      return;
    }
    if (!data.length) {
      $("recordList").innerHTML = '<div class="empty">這個日期／條件目前沒有停放紀錄。</div>';
      return;
    }
    $("recordList").innerHTML = data.map(row => {
      const custom = row.location_type === "custom";
      const mapUrl = getMapUrl(row);
      const map = mapUrl
        ? '<a class="map-link" target="_blank" rel="noopener" href="'+mapUrl+'">在地圖查看 ↗</a>' : "";
      return '<article class="record-card">'+
        '<div class="record-head"><div><div class="place-name">'+(custom ? "📍 " : "🏠 ")+escapeHtml(row.location_name)+'</div>'+
        '<div class="record-meta">'+escapeHtml(row.parked_at)+' · '+new Date(row.created_at).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})+'</div></div>'+map+'</div>'+
        (row.note ? '<p class="record-note">'+escapeHtml(row.note)+'</p>' : '')+
        '<div class="record-meta">建立者：'+escapeHtml(row.created_by_email || "共同使用者")+'</div>'+
        '<div class="record-actions"><button class="edit-btn" data-edit="'+row.id+'">修改</button><button class="delete-btn" data-delete="'+row.id+'">刪除</button></div>'+
        '</article>';
    }).join("");
  };
  const playPawStamp = () => new Promise(resolve => {
    const stamp = $("pawStamp");
    if (!stamp) return resolve();
    stamp.classList.remove("play");
    void stamp.offsetWidth;
    stamp.classList.add("play");
    window.setTimeout(() => {
      stamp.classList.remove("play");
      resolve();
    }, 850);
  });
  const saveRecord = async (event) => {
    event.preventDefault();
    if (!selectedPlace) return;
    if (selectedPlace === "__custom__" && !gps) {
      setMessage("recordMessage","請先取得其他位置的 GPS 定位。");
      return;
    }
    const isCustom = selectedPlace === "__custom__";
    const payload = {
      parked_at:$("recordDate").value,
      location_type:isCustom ? "custom" : "fixed",
      location_name:isCustom ? "其他位置" : selectedPlace,
      latitude:isCustom ? gps.lat : null,
      longitude:isCustom ? gps.lng : null,
      note:$("note").value.trim() || null,
      created_by:user.id,
      created_by_email:user.email || null
    };
    $("saveBtn").disabled = true;
    $("saveBtn").textContent = "喵～蓋章確認中…";
    await playPawStamp();
    $("saveBtn").textContent = "儲存中…";
    const {error} = await db.from("parking_records").insert(payload);
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "確認停放地點";
    if (error) {
      setMessage("recordMessage","儲存失敗："+error.message);
      return;
    }
    setMessage("recordMessage","已成功儲存停放紀錄。",true);
    $("note").value = "";
    setSelectedPlace("");
    await loadRecords();
  };
  const editRecord = async (id) => {
    const {data:row,error} = await db.from("parking_records").select("*").eq("id",id).single();
    if (error) return alert("讀取紀錄失敗："+error.message);
    const date = prompt("停放日期（YYYY-MM-DD）",row.parked_at);
    if (date === null) return;
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return alert("日期格式不正確。");
    const placeCodes = {
      "市場全聯":"A","舊小象旁邊":"B","85度C/燒臘店對面":"C",
      "夾娃娃機/洗衣店旁":"D","紀醫師前面":"E",
      "全聯":"A","全聯旁邊":"A","舊小象":"B","舊小巷":"B",
      "85度C":"C","夾娃娃機":"D","洗衣店(燒臘店旁)":"D","紀醫師":"E"
    };
    const currentChoice = row.location_type === "custom" ? "G" : (placeCodes[row.location_name] || "A");
    const choice = prompt("停放位置：輸入 A=市場全聯、B=舊小象旁邊、C=85度C/燒臘店對面、D=夾娃娃機/洗衣店旁、E=紀醫師前面，或 G（其他 GPS 位置）",currentChoice);
    if (choice === null) return;
    const normalized = choice.trim().toUpperCase();
    let location_type, location_name, latitude = null, longitude = null;
    if (["A","B","C","D","E"].includes(normalized)) {
      location_type = "fixed";
      location_name = {"A":"市場全聯","B":"舊小象旁邊","C":"85度C/燒臘店對面","D":"夾娃娃機/洗衣店旁","E":"紀醫師前面"}[normalized];
    } else if (normalized === "G") {
      location_type = "custom";
      location_name = "其他位置";
      const lat = prompt("GPS 緯度",row.latitude == null ? "" : String(row.latitude));
      if (lat === null) return;
      const lng = prompt("GPS 經度",row.longitude == null ? "" : String(row.longitude));
      if (lng === null) return;
      latitude = Number(lat);
      longitude = Number(lng);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return alert("GPS 座標不正確。");
      }
    } else {
      return alert("位置請輸入 A、B、C、D 或 G。");
    }
    const note = prompt("備註（留空代表清除）",row.note || "");
    if (note === null) return;
    const {error:updateError} = await db.from("parking_records").update({
      parked_at:date,location_type,location_name,latitude,longitude,note:note.trim() || null
    }).eq("id",id);
    if (updateError) return alert("修改失敗："+updateError.message);
    await loadRecords();
  };
  const deleteRecord = async (id) => {
    if (!confirm("確定刪除這筆停放紀錄？刪除後無法復原。")) return;
    const {error} = await db.from("parking_records").delete().eq("id",id);
    if (error) return alert("刪除失敗："+error.message);
    await loadRecords();
  };

  if (!configured || !window.supabase) {
    $("configNotice").classList.remove("hidden");
    $("configNotice").textContent = !configured
      ? "尚未設定 Supabase。請先建立獨立 Supabase 專案，並將 Project URL 與 anon/public key 填入 config.js。"
      : "Supabase 程式庫載入失敗，請確認網路連線後重新整理。";
    $("authPanel").classList.remove("hidden");
    $("authForm").addEventListener("submit",e=>e.preventDefault());
    return;
  }

  db = window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try { await auth("login"); } catch(err) { setMessage("authMessage",err.message); }
  });
  $("logoutBtn").addEventListener("click",async()=>{
    await db.auth.signOut();
    showApp(null);
  });
  document.querySelectorAll(".location-choice").forEach(btn=>
    btn.addEventListener("click",()=>{setSelectedPlace(btn.dataset.place);setMessage("recordMessage","");}));
  $("gpsBtn").addEventListener("click",async()=>{
    $("gpsBtn").disabled = true;
    $("gpsBtn").textContent = "正在取得定位…";
    try {
      gps = await getGps();
      selectedPlace = "__custom__";
      document.querySelectorAll(".location-choice").forEach(btn=>btn.classList.remove("selected"));
      $("gpsStatus").textContent = "已取得目前位置，精確度約 "+Math.round(gps.accuracy)+" 公尺。";
      $("gpsCoordinates").textContent = "緯度 "+gps.lat.toFixed(6)+"，經度 "+gps.lng.toFixed(6);
      $("gpsCoordinates").classList.remove("hidden");
      $("saveBtn").disabled = false;
      $("saveBtn").textContent = "確認停放地點";
      setMessage("recordMessage","");
    } catch(err) {
      gps = null;
      selectedPlace = "";
      $("gpsStatus").textContent = err.message;
      $("saveBtn").disabled = true;
    } finally {
      $("gpsBtn").disabled = false;
      $("gpsBtn").textContent = "◎ 其他位置：取得目前 GPS";
    }
  });
  $("prevMonth").addEventListener("click",()=>{
    calendarMonth = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);
    renderCalendar();
  });
  $("nextMonth").addEventListener("click",()=>{
    calendarMonth = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);
    renderCalendar();
  });
  $("calendarDays").addEventListener("click",e=>{
    const day = e.target.closest("[data-date]");
    if (day) chooseCalendarDate(day.dataset.date);
  });
  $("recordForm").addEventListener("submit",saveRecord);
  $("recordList").addEventListener("click",e=>{
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    if (edit) editRecord(edit.dataset.edit);
    if (del) deleteRecord(del.dataset.delete);
  });
  db.auth.getSession().then(({data})=>showApp(data.session?.user || null));
  db.auth.onAuthStateChange((_event,session)=>showApp(session?.user || null));
})();