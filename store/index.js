const express = require('express');
const path = require('path');
const app = express();

// স্ট্যাটিক ফাইলগুলো 'store' ফোল্ডার থেকে সার্ভ করার জন্য
app.use(express.static(path.join(__dirname, 'store')));

// রুট বা হোমপেজে ভিজিট করলে store ফোল্ডারের index.html দেখানোর জন্য
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'store', 'index.html'));
});

// রেন্ডার সার্ভারের জন্য পোর্ট কনফিগারেশন
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`FM FASHION API running on ${PORT}`);
});
