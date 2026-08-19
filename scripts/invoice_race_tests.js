async function racetestInvoices() {
    const arg2 = process.argv[2];
    const customerID= arg2? parseInt(arg2):1;
    const randomYear = 2000 + Math.floor(Math.random() * 20);
    const period_start = `${randomYear}-01-01`;
    const period_end = `${randomYear}-02-01`;
    const URL = "http://localhost:3000/invoices";
    const num_requests = 20;
    console.log(`firing ${num_requests} concurrent requests for period ${period_start} to ${period_end}`);
    const promises=[];
    for(let i=1;i<=num_requests;i++){
        promises.push(
            fetch(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerID: customerID,
                    period_start: period_start,
                    period_end: period_end
                })
            })
        )
    }
    const response=await Promise.all(promises);
    const successful_responses=response.filter(res=>res.status===201).length;
    const failed_responses=response.filter(res=>res.status===409).length;
    const other_responses=response.length-failed_responses-successful_responses;
    console.log(`${successful_responses} X 201 , ${failed_responses} X 409 and ${other_responses} other responses`);
    console.log("All requests completed.");

}
racetestInvoices();