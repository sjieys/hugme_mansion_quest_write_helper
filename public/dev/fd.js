(async() => {
    try{
        const url = 'http://127.0.0.1:3000/data';
        const res = await fetch(url);
        const raw = await res.text();
    }catch(e) {
        console.log("raw오류");
    }
}
)();

const url = '/data';
