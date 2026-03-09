const shipments = [
	{
		awb: "AWB001",
		status: "In Transit",
		progress: 60,
		origin: "Shanghai",
		destination: "New York",
		weight: 500,
		vesselName: "MSC Oscar",
		transport: "sea",
		insurance: true,
		customsValue: 12000,
		events: [
			{ status: "Accepted", location: "Shanghai", time: "2026-02-10 09:00" },
			{ status: "Loaded", location: "Shanghai Port", time: "2026-02-12 11:30" },
			{ status: "In Transit", location: "Pacific Ocean", time: "2026-02-20 14:30" }
		]
	},
	{
		awb: "AWB002",
		status: "Delivered",
		progress: 100,
		origin: "Rotterdam",
		destination: "Singapore",
		weight: 200,
		vesselName: "Evergreen",
		transport: "sea",
		insurance: false,
		customsValue: 4000,
		events: [
			{ status: "Accepted", location: "Rotterdam", time: "2026-01-03 08:10" },
			{ status: "In Transit", location: "Suez Canal", time: "2026-01-12 17:22" },
			{ status: "Delivered", location: "Singapore", time: "2026-02-02 10:00" }
		]
	},
	{
		awb: "AWB003",
		status: "Pending",
		progress: 20,
		origin: "Los Angeles",
		destination: "Tokyo",
		weight: 1000,
		vesselName: "HMM",
		transport: "air",
		insurance: true,
		customsValue: 18000,
		events: [{ status: "Booked", location: "Los Angeles", time: "2026-02-25 09:00" }]
	},
	{
		awb: "AWB004",
		status: "Delivered",
		progress: 100,
		origin: "Dubai",
		destination: "London",
		weight: 300,
		vesselName: "OOCL",
		transport: "sea",
		insurance: false,
		customsValue: 6500,
		events: [
			{ status: "Accepted", location: "Dubai", time: "2026-01-20 10:00" },
			{ status: "Delivered", location: "London", time: "2026-02-15 16:00" }
		]
	},
	{
		awb: "AWB005",
		status: "In Transit",
		progress: 75,
		origin: "Busan",
		destination: "Hamburg",
		weight: 750,
		vesselName: "CMA",
		transport: "sea",
		insurance: true,
		customsValue: 9500,
		events: [
			{ status: "Accepted", location: "Busan", time: "2026-02-05 07:30" },
			{ status: "In Transit", location: "Yantian", time: "2026-02-10 12:00" }
		]
	}
];

function getShipmentByAWB(awb){
return shipments.find(s=>s.awb.toLowerCase()===awb.toLowerCase());
}

function formatCurrency(n){
	return '$' + Number(n).toFixed(2);
}

function computePricing(shipment){
	// Pricing rules:
	// - base rate per kg = $2.00
	// - volume discounts: weight >= 1000kg -> 10%, >=500kg -> 5%
	// - insurance surcharge: 1.5% of post-discount base if insurance true
	// - customs & handling: flat $50 + 2% of customsValue (if provided)
	var ratePerKg = 2.0;
	var base = ratePerKg * shipment.weight;
	var discount = 0;
	if(shipment.weight >= 1000) discount = 0.10;
	else if(shipment.weight >= 500) discount = 0.05;

	var discountAmount = base * discount;
	var afterDiscount = base - discountAmount;
	var insuranceSurcharge = shipment.insurance ? afterDiscount * 0.015 : 0;
	var customsFee = 50 + (shipment.customsValue ? shipment.customsValue * 0.02 : 0);
	var total = afterDiscount + insuranceSurcharge + customsFee;

	return {
		base: base,
		discountPercent: discount,
		discountAmount: discountAmount,
		afterDiscount: afterDiscount,
		insuranceSurcharge: insuranceSurcharge,
		customsFee: customsFee,
		total: total
	};
}

document.addEventListener("DOMContentLoaded",()=>{

const dashboard = document.getElementById("statusChart");
const total = shipments.length;
if(dashboard){
const delivered = shipments.filter(s=>s.status==="Delivered").length;
const transit = shipments.filter(s=>s.status==="In Transit").length;
const pending = shipments.filter(s=>s.status==="Pending").length;

animateValue("totalShipments",total);
animateValue("deliveredCount",delivered);
animateValue("transitCount",transit);
animateValue("pendingCount",pending);

const ctx1=document.getElementById("statusChart").getContext("2d");

// keep chart instances globally so we can update them from live updates
window.statusChart = new Chart(ctx1,{
type:"doughnut",
data:{
labels:["Delivered","Transit","Pending"],
datasets:[{
data:[delivered,transit,pending],
backgroundColor:["#16a34a","#2563eb","#f59e0b"]
}]
},
options:{responsive:true,animation:{duration:1200}}
});

const ctx2=document.getElementById("progressChart").getContext("2d");

window.progressChart = new Chart(ctx2,{
type:"bar",
data:{
labels:shipments.map(s=>s.awb),
datasets:[{
label:"Progress %",
data:shipments.map(s=>s.progress),
backgroundColor:"#2563eb"
}]
},
options:{responsive:true}
});

document.getElementById("dashboardSearchBtn").onclick=()=>{
const awb=document.getElementById("dashboardAwbInput").value;
const s=getShipmentByAWB(awb);

if(s) window.location.href=`shipment-details.html?awb=${s.awb}`;
else alert("Shipment not found");
}

}

const trackBtn = document.getElementById("trackingSearchBtn");
if(trackBtn){
trackBtn.onclick=()=>searchShipment(document.getElementById("awbInput").value);
}

const detailsContainer = document.getElementById("detailsContainer");
if(detailsContainer){
const params=new URLSearchParams(window.location.search);
renderShipmentDetails(params.get("awb"));
}

});

// --- Live updates simulation ------------------------------------------------
let liveInterval = null;
function updateCharts(){
	try{
		// recompute counts
		const delivered = shipments.filter(s=>s.status==="Delivered").length;
		const transit = shipments.filter(s=>s.status==="In Transit").length;
		const pending = shipments.filter(s=>s.status==="Pending").length;
		if(window.statusChart){
			window.statusChart.data.datasets[0].data = [delivered, transit, pending];
			window.statusChart.update();
		}
		if(window.progressChart){
			window.progressChart.data.datasets[0].data = shipments.map(s=>s.progress);
			window.progressChart.update();
		}
	}catch(e){console.warn('updateCharts',e)}
}

function startLiveUpdates(filterTransport){
	if(liveInterval) clearInterval(liveInterval);
	liveInterval = setInterval(()=>{
		// choose a random shipment, optionally filtered by transport
		let pool = shipments.slice();
		if(filterTransport && filterTransport!=='all'){
			pool = pool.filter(s=>s.transport && s.transport.toLowerCase()===filterTransport.toLowerCase());
		}
		if(pool.length===0) return;
		const i = Math.floor(Math.random()*pool.length);
		const shipment = pool[i];
		// advance progress randomly
		const delta = Math.ceil(Math.random()*8);
		const oldProgress = shipment.progress;
		shipment.progress = Math.min(100, shipment.progress + delta);
		// set status
		if(shipment.progress>=100) shipment.status = 'Delivered';
		else if(shipment.progress>0) shipment.status = 'In Transit';

		// push a new event
		const location = (shipment.transport && shipment.transport.toLowerCase()==='air') ? 'In flight' : 'At sea / en route';
		const now = new Date().toLocaleString();
		shipment.events.push({ status: shipment.progress>=100 ? 'Delivered' : 'In Transit', location: location, time: now });

		// update UI pieces if present
		// re-render shipments list if visible
		if(document.getElementById('shipmentsList')){
			try{ renderShipmentsList(); }catch(e){}
		}
		// if tracking result currently shows this AWB, re-run search to refresh
		const trackingResult = document.getElementById('trackingResult');
		if(trackingResult && trackingResult.innerHTML.includes(shipment.awb)){
			try{ searchShipment(shipment.awb); }catch(e){}
		}
		// if details page open for this AWB, re-render
		const detailsContainer = document.getElementById('detailsContainer');
		if(detailsContainer){
			const params=new URLSearchParams(window.location.search);
			const awb = params.get('awb');
			if(awb && awb.toLowerCase()===shipment.awb.toLowerCase()){
				try{ renderShipmentDetails(shipment.awb); }catch(e){}
			}
		}

		updateCharts();
	}, 4000);
}

function stopLiveUpdates(){
	if(liveInterval){ clearInterval(liveInterval); liveInterval = null; }
}

// Wire live behavior after DOM ready — enforce always-on live updates
document.addEventListener('DOMContentLoaded', function(){
	var liveToggle = document.getElementById('liveToggle');
	var transportFilter = document.getElementById('transportFilter');
	var liveIndicator = document.getElementById('liveIndicator');

	// Ensure the live toggle (if present) reflects always-on and cannot be changed by the user
	if(liveToggle){
		try{ liveToggle.checked = true; }catch(e){}
		try{ liveToggle.disabled = true; }catch(e){}
	}

	// Keep transport filter functionality: changing it restarts live updates with the new filter
	if(transportFilter){
		transportFilter.addEventListener('change', function(){
			// restart live updates with new filter
			stopLiveUpdates();
			startLiveUpdates(transportFilter.value || 'all');
		});
	}

	// Start live updates unconditionally on page load
	var initialFilter = (transportFilter && transportFilter.value) ? transportFilter.value : 'all';
	startLiveUpdates(initialFilter);
	if(liveIndicator) liveIndicator.style.display = 'inline-block';
});

function animateValue(id,end){

let start=0;
let obj=document.getElementById(id);
if(!obj) return;
if(end === 0) { obj.innerText = 0; return; }

let timer=setInterval(()=>{

start++;
obj.innerText=start;

if(start==end) clearInterval(timer)

},100)

}

function searchShipment(awb){

const result=document.getElementById("trackingResult");
const shipment=getShipmentByAWB(awb);

if(!shipment){
result.innerHTML="<p>Shipment not found</p>";
return;
}

result.innerHTML=`
<h3>AWB: ${shipment.awb}</h3>
<p>Current Status: <strong>${shipment.status}</strong></p>
<p>Progress: ${shipment.progress}%</p>
<a href="shipment-details.html?awb=${shipment.awb}">View Details</a>
`;

}

function renderShipmentDetails(awb){

const shipment=getShipmentByAWB(awb);
const container=document.getElementById("detailsContainer");

if(!shipment){
container.innerHTML="Shipment not found";
return;
}

container.innerHTML=`
<h2>${shipment.awb}</h2>
<p>Status: ${shipment.status}</p>
<p>Origin: ${shipment.origin}</p>
<p>Destination: ${shipment.destination}</p>
<p>Weight: ${shipment.weight} kg</p>
<p>Vessel: ${shipment.vesselName}</p>
<p>Progress: ${shipment.progress}%</p>
<div class="progress-bar">
<div class="progress-inner" id="progressBar"></div>
</div>

`;

// Pricing breakdown
const pricing = computePricing(shipment);
container.innerHTML += `
<div class="pricing-block">
	<h3 class="pricing-title">Pricing Breakdown</h3>
	<div class="pricing-row"><span>Base price (${shipment.weight}kg @ $2/kg)</span><span class="pricing-value">${formatCurrency(pricing.base)}</span></div>
	<div class="pricing-row"><span>Volume discount (${pricing.discountPercent * 100}%)</span><span class="pricing-value">- ${formatCurrency(pricing.discountAmount)}</span></div>
	<div class="pricing-row"><span>Insurance surcharge</span><span class="pricing-value">${formatCurrency(pricing.insuranceSurcharge)}</span></div>
	<div class="pricing-row"><span>Customs & handling</span><span class="pricing-value">${formatCurrency(pricing.customsFee)}</span></div>
	<div class="pricing-total"><span>Total</span><span class="pricing-value total-value">${formatCurrency(pricing.total)}</span></div>
</div>
`;

setTimeout(()=>{
document.getElementById("progressBar").style.width=shipment.progress+"%"
},200)

}
