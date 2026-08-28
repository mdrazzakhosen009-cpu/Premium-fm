// AI Chat Submit Handler Fix
let isSending = false;
$("#chatForm").onsubmit = async e => {
    e.preventDefault();
    if (isSending) return; // একাধিকবার ক্লিক বা সাবমিট হওয়া রোধ করবে

    const q = $("#chatInput").value.trim();
    if (!q) return;

    isSending = true;
    const submitBtn = $("#chatForm").querySelector("button[type='submit']") || $("#chatSendBtn");
    if (submitBtn) submitBtn.disabled = true;

    bubble(q, "user");
    $("#chatInput").value = "";
    bubble("ভাবছি…", "bot");

    try {
        const j = await api("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: q })
        });
        
        // আগের "ভাবছি..." বাবলটি রিমूव করে সার্ভারের সঠিক উত্তরটি একবারই দেখাবে
        const messagesContainer = $("#messages");
        if (messagesContainer.lastElementChild) {
            messagesContainer.lastElementChild.remove();
        }
        bubble(j.reply || "দুঃখিত, এখন উত্তর দিতে পারছি না।", "bot");
    } catch {
        const messagesContainer = $("#messages");
        if (messagesContainer.lastElementChild) {
            messagesContainer.lastElementChild.remove();
        }
        toast("AI service unavailable");
    } finally {
        isSending = false;
        if (submitBtn) submitBtn.disabled = false;
    }
};
