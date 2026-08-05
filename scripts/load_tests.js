const customerID=1;
const num_requests=50;
const URL = `http://localhost:3000/customer-usage-counts/${customerID}/increment`;

async function runloadTest(){
    console.log(`firing ${num_requests} requests to ${URL}`);
    const promises=[];
    for(let i=0;i<num_requests;i++){
        promises.push(fetch(URL,{method: "POST"}))
    }
    await Promise.all(promises);
    console.log("All requests completed.");
}
runloadTest();