function calculateVerdict() {
    const target = parseFloat(document.getElementById('target').value);
    const years = parseFloat(document.getElementById('years').value);
    const select = document.getElementById('inflation');
    const inflationRate = parseFloat(select.value) / 100;
    
    let currency = "$";
    if (select.selectedIndex === 0) currency = "$";
    if (select.selectedIndex === 1) currency = "€";
    if (select.selectedIndex === 2) currency = "PLN";

    if (!target || !years || years <= 0 || target <= 0) {
        alert("Please enter valid numbers.");
        return;
    }

    const realValue = target / Math.pow((1 + inflationRate), years);
    const monthlySave = target / (years * 12);
    const lossPercentage = Math.round(((target - realValue) / target) * 100);

    document.getElementById('resNominal').innerText = target.toLocaleString() + ' ' + currency;
    document.getElementById('resReal').innerText = Math.round(realValue).toLocaleString() + ' ' + currency;
    document.getElementById('resMonthly').innerText = Math.round(monthlySave).toLocaleString() + ' ' + currency + '/mo';

    document.getElementById('resVerdict').innerText = `Financial Verdict: In ${years} years, inflation will destroy ${lossPercentage}% of your money's purchasing power. Your future amount will be equivalent to just ${Math.round(realValue).toLocaleString()} ${currency} in today's money. To preserve its value, this capital must be invested at a rate higher than inflation.`;
    
    document.getElementById('resultBox').style.display = 'block';
}
