// const customerID=1;
// const num_requests=50;
// const URL = `http://localhost:3000/customer-usage-counts/${customerID}/increment`;

// async function runloadTest(){
//     console.log(`firing ${num_requests} requests to ${URL}`);
//     const promises=[];
//     for(let i=0;i<num_requests;i++){
//         promises.push(fetch(URL,{method: "POST"}))
//     }
//     const response=await Promise.all(promises);
//     const successful_responses=response.filter(res=>res.ok).length;
//     const failed_responses=response.length-successful_responses;
//     console.log(`${successful_responses} succeeded and ${failed_responses} failed`);
//     console.log("All requests completed.");
// }
// runloadTest();

async function runloadtest() {
    const arg = process.argv[2];
    const arg2 = process.argv[3]
    const num_requests = arg ? parseInt(arg) : 50;
    const customerID= arg2? parseInt(arg2):1;
    if(Number.isNaN(num_requests)){
        console.log("invalid arguments");
        return;
    }
    const URL = `http://localhost:3000/customer-usage-counts/${customerID}/increment`;

    console.log(`firing ${num_requests} requests to ${URL}`);
    const promises=[];
    for(let i=0;i<num_requests;i++){
        promises.push(fetch(URL,{method: "POST"}))
    }
    const response=await Promise.all(promises);
    const successful_responses=response.filter(res=>res.ok).length;
    const failed_responses=response.length-successful_responses;
    console.log(`${successful_responses} succeeded and ${failed_responses} failed`);
    console.log("All requests completed.");

    
    
}
runloadtest();