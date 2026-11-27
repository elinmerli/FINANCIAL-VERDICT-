// Массив готических экономических пророчеств
const gothicProphecies = [
    "Wealth is but a phantom in the swamps of time. The longer it sits, the deeper it sinks.",
    "Inflation is the silent moss that claims the stone; your gold will rot before the century turns.",
    "The market does not weep for broken dreams. It only demands fresh sacrifices.",
    "Paper illusions will crumble into dust, leaving only the iron structures of real assets.",
    "Time is a raven circling your capital. Every tick of the clock is a feather lost."
];

// Функция запуска расчетов при клике на кнопку
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
        alert("The void rejects empty numbers. Enter valid parameters.");
        return;
    }

    // Главные экономические расчеты (Дисконтирование капитала)
    const realValue = target / Math.pow((1 + inflationRate), years);
    const monthlySave = target / (years * 12);
    const lossPercentage = Math.round(((target - realValue) / target) * 100);

    // Вывод текстовых результатов
    document.getElementById('resNominal').innerText = target.toLocaleString() + ' ' + currency;
    document.getElementById('resReal').innerText = Math.round(realValue).toLocaleString() + ' ' + currency;
    document.getElementById('resMonthly').innerText = Math.round(monthlySave).toLocaleString() + ' ' + currency + '/mo';

    document.getElementById('resVerdict').innerText = `Verdict of Time: In ${years} years, the decay of inflation will consume ${lossPercentage}% of your wealth. Your capital will wither down to an equivalent of just ${Math.round(realValue).toLocaleString()} ${currency} in today's money. Dust to dust, value to dust.`;
    
    // Показываем блок результатов
    document.getElementById('resultBox').style.display = 'block';

    // Строим визуальный график деградации капитала через чистый CSS/DOM
    generateVisualChart(target, inflationRate, years, currency);
    
    // Генерируем случайное пророчество
    const randomProphecy = gothicProphecies[Math.floor(Math.random() * gothicProphecies.length)];
    document.getElementById('prophecyText').innerText = `"${randomProphecy}"`;
}

// Функция генерации кастомного готического графика
function generateVisualChart(initialCapital, rate, duration, currency) {
    const chartContainer = document.getElementById('visualChart');
    chartContainer.innerHTML = ''; // Очищаем старый график

    // Рассчитываем шаги (максимум 5 точек для наглядности)
    const steps = duration > 5 ? 5 : duration;
    const stepYear = Math.ceil(duration / steps);

    for (let i = 0; i <= steps; i++) {
        const currentYear = Math.min(i * stepYear, duration);
        const currentVal = initialCapital / Math.pow((1 + rate), currentYear);
        const heightPercent = (currentVal / initialCapital) * 100;

        // Создаем элемент столбца
        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-wrapper';
        
        barWrapper.innerHTML = `
            <div class="chart-bar" style="height: ${heightPercent}%">
                <span class="chart-val">${Math.round(currentVal / 1000)}k</span>
            </div>
            <div class="chart-label">Yr ${currentYear}</div>
        `;
        chartContainer.appendChild(barWrapper);
        
        if (currentYear === duration) break;
    }
}

// Интерактивный симулятор рыночных циклов
function simulateCycle() {
    const events = [
        { title: "Hyperinflation Scare", effect: "Your cash loses 15% purchasing power instantly.", color: "#8c2d19" },
        { title: "The Great Stagnation", effect: "Markets freeze. Interest rates spike to 6.5%.", color: "#4b5563" },
        { title: "Ghost Rally", effect: "Asset prices inflate artificially by 12%. A trap for fools.", color: "#ba9663" },
        { title: "Black Swan Event", effect: "Global supply chain collapse. Cash is king, but it burns.", color: "#11121a" }
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    const logBox = document.getElementById('simulationLog');
    
    logBox.style.borderColor = randomEvent.color;
    logBox.innerHTML = `
        <strong style="color: ${randomEvent.color}; text-transform: uppercase;">[EVENT]: ${randomEvent.title}</strong>
        <p style="margin-top: 5px; font-style: italic;">${randomEvent.effect}</p>
    `;
}
