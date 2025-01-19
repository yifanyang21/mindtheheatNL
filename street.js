function addStreetInteractions(layer) {
    layer.on('mouseover', handleMouseOver);
    layer.on('mouseout', handleMouseOut);
    layer.on('click', handleClick);
}

function handleMouseOver(e) {
    const properties = e.target.feature.properties;
    const riskLevel = getRiskLevel(properties);
    const streetName = getStreetName(properties);
    const tooltipContent = `
        <strong>${streetName}</strong><br>
        <strong>${riskLevel}</strong> (${properties.Final_score_all})
    `;
    const tooltip = L.tooltip({
        permanent: false,
        direction: 'top',
        className: 'street-tooltip'
    })
        .setContent(tooltipContent)
        .setLatLng(e.latlng);
    e.target.bindTooltip(tooltip).openTooltip();
    e.target.setStyle({ weight: 5, color: '#dcdcdc' });
}

function handleMouseOut(e) {
    e.target.unbindTooltip();
    streetLayer.resetStyle(e.target);
}

function handleClick(e) {
    const properties = e.target.feature.properties;
    const riskLevel = getRiskLevel(properties);
    const streetName = getStreetName(properties);
    const flowLevel = getFlowLevel(properties);
    const shadeLevel = getShadeLevel(properties);

    const infoBox = document.getElementById('info-box');
    infoBox.innerHTML = `
        <button class="close-button" onclick="closeInfoBox()">
            <img src="img/right.png" alt="Close" class="close-icon">
        </button>
        <div class="final-score"><strong>${riskLevel}</strong></div>
        <div class="street-name">${streetName}</div>
        <div id="chart1" class="chart-section"></div>
        <div id="chart2" class="chart-section"></div>
        <div id="chart3" class="chart-section"></div>
    `;
    infoBox.style.display = 'block';
    renderCharts(properties, flowLevel, shadeLevel);
}

function getRiskLevel(properties) {
    if (properties.PET === 0) {
        return 'geen gegevens';
    } else if (properties.Final_score_all >= 0.75) {
        return 'Hoog risico';
    } else if (properties.Final_score_all >= 0.5) {
        return 'Gemiddeld risico';
    }
    return 'Laag risico';
}

function getStreetName(properties) {
    return properties.name && properties.name !== '0' ? properties.name : 'Naamloos';
}

function getFlowLevel(properties) {
    if (properties.jenkins_bin === 'bin_4' || properties.jenkins_bin === 'bin_3') {
        return 'Hoge intensiteit';
    } else if (properties.jenkins_bin === 'bin_2') {
        return 'Gemiddelde intensiteit';
    }
    return 'Lage intensiteit';
}

function getShadeLevel(properties) {
    return properties.sum_adjust >= 12 ? 'Onvoldoende schaduw' : 'Voldoende schaduw';
}

function renderCharts(properties, flowLevel, shadeLevel) {
    renderChart1(properties, flowLevel);
    renderChart2(properties, shadeLevel);
    renderChart3(properties);
}

function renderChart1(properties, flowLevel) {
    const chart1 = document.getElementById('chart1');
    const buurtData = properties.buurtcode;
    const totalPop = properties.pop;
    let buurtInfo;

    if (totalPop === 0 || buurtData === '0' || Object.keys(buurtData).length === 0) {
        buurtInfo = 'geen gegevens';
    } else {
        buurtInfo = Object.entries(buurtData)
            .map(([code, count]) => {
                const percentage = ((count / totalPop) * 100).toFixed(2);
                const buurt = neighborhoodData.features.find(feature => feature.properties.CBS_Buurtcode === code).properties.Buurt;
                const buurtCode = code.replace('BU0363', '');
                return { percentage, buurtInfo: `${percentage}% van ${buurt} (${buurtCode})` };
            })
            .sort((a, b) => b.percentage - a.percentage)
            .map(entry => entry.buurtInfo)
            .join('<br>');
    }

    chart1.innerHTML = `
        <div class="chart-title">Modelleerde voetgangersintensiteit</div>
        <div class="chart-value">${flowLevel}</div>
        <div class="chart-sub-title">Geschatte leeftijdsverdeling</div>
        <div id="age-group-chart" class="age-group-chart"></div>
        <div class="chart-sub-title">Buurt van herkomst</div>
        <div class="chart-tick-label">${buurtInfo}</div>
    `;
    renderAgeGroupChart(properties);
}

function renderAgeGroupChart(properties) {
    const data = [
        { ageGroup: '<15', percentage: properties.young_pop_pct },
        { ageGroup: '>65', percentage: properties.old_pop_pct },
    ];

    const svg = d3.select('#age-group-chart').append('svg')
        .attr('width', '100%')
        .attr('height', 50);

    const widthScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, 300]);

    svg.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', widthScale(100))
        .attr('height', 15)
        .attr('fill', '#F1F1F1');

    svg.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', widthScale(data[0].percentage))
        .attr('height', 15)
        .attr('fill', '#E63946');

    svg.append('rect')
        .attr('x', widthScale(100) - widthScale(data[1].percentage))
        .attr('y', 0)
        .attr('width', widthScale(data[1].percentage))
        .attr('height', 15)
        .attr('fill', '#E63946');

    svg.selectAll('text.chart-tick-label')
        .data(data)
        .enter()
        .append('text')
        .attr('x', (d, i) => i === 0 ? 5 : widthScale(100) - 10)
        .attr('y', 30)
        .attr('text-anchor', (d, i) => i === 0 ? 'start' : 'end')
        .text(d => {
            if (d.percentage === 0) {
                return `${d.ageGroup}: no data`;
            }
            return `${d.ageGroup}: ${d.percentage.toFixed(2)}%`;
        })
        .attr('class', 'chart-tick-label');
}

function renderChart2(properties, shadeLevel) {
    const chart2 = document.getElementById('chart2');
    if (properties.PET === 0) {
        chart2.innerHTML = `
            <div class="chart-title">Schaduwdekking</div>
            <div class="chart-value">geen gegevens</div>
        `;
        return;
    }
    chart2.innerHTML = `
        <div class="chart-title">Schaduwdekking</div>
        <div class="chart-value">${shadeLevel}</div>
    `;
    renderBarChart(properties);
}

function renderBarChart(properties) {
    const data = [
        { hour: '09:00', value: 1 - properties['0900'] },
        { hour: '09:30', value: 1 - properties['0930'] },
        { hour: '10:00', value: 1 - properties['1000'] },
        { hour: '10:30', value: 1 - properties['1030'] },
        { hour: '11:00', value: 1 - properties['1100'] },
        { hour: '11:30', value: 1 - properties['1130'] },
        { hour: '12:00', value: 1 - properties['1200'] },
        { hour: '12:30', value: 1 - properties['1230'] },
        { hour: '13:00', value: 1 - properties['1300'] },
        { hour: '13:30', value: 1 - properties['1330'] },
        { hour: '14:00', value: 1 - properties['1400'] },
        { hour: '14:30', value: 1 - properties['1430'] },
        { hour: '15:00', value: 1 - properties['1500'] },
        { hour: '15:30', value: 1 - properties['1530'] },
        { hour: '16:00', value: 1 - properties['1600'] },
        { hour: '16:30', value: 1 - properties['1630'] },
        { hour: '17:00', value: 1 - properties['1700'] },
        { hour: '17:30', value: 1 - properties['1730'] },
        { hour: '18:00', value: 1 - properties['1800'] },
        { hour: '18:30', value: 1 - properties['1830'] },
        { hour: '19:00', value: 1 - properties['1900'] },
        { hour: '19:30', value: 1 - properties['1930'] },
        { hour: '20:00', value: 1 - properties['2000'] }
    ];

    const opacityValues = {
        '0900': 0.3,
        '0930': 0.3,
        '1000': 0.5,
        '1030': 0.5,
        '1100': 0.5,
        '1130': 1.0,
        '1200': 1.0,
        '1230': 1.0,
        '1300': 1.0,
        '1330': 1.0,
        '1400': 1.0,
        '1430': 1.0,
        '1500': 1.0,
        '1530': 1.0,
        '1600': 1.0,
        '1630': 1.0,
        '1700': 0.5,
        '1730': 0.5,
        '1800': 0.5,
        '1830': 0.5,
        '1900': 0.3,
        '1930': 0.3,
        '2000': 0.3
    };

    const svg = d3.select('#chart2').append('svg')
        .attr('width', '100%')
        .attr('height', '100%');

    const margin = { top: 20, right: 20, bottom: 20, left: 40 };
    const width = svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = svg.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const x = d3.scaleBand()
        .domain(data.map(d => d.hour))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0]);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(data.map(d => d.hour)).tickFormat((d, i) => i % 2 === 0 ? d.replace(':00', 'h') : ''))
        .selectAll('text')
        .style('font-size', '8.5px');

    g.append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(y).ticks(10, '%'))
        .style('font-size', '8.5px');

    g.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.hour))
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', '#b4e0ea')
        .attr('fill-opacity', d => opacityValues[d.hour.replace(':', '')]);
}

function renderChart3(properties) {
    const chart3 = document.getElementById('chart3');
    if (properties.PET === 0) {
        chart3.innerHTML = `
            <div class="chart-title">PET</div>
            <div class="chart-value">geen gegevens</div>
        `;
        return;
    }
    chart3.innerHTML = `
        <div class="chart-title">PET</div>
        <div class="chart-value">${properties.PET.toFixed(2)}&#8451;</div>
    `;
    createGaugeChart('chart3', properties.PET);
}

function createGaugeChart(chartId, selectedValue) {
    const svg = d3.select(`#${chartId}`).append('svg')
        .attr('width', '80%')
        .attr('height', '80%')
        .attr('viewBox', '0 0 150 75')
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const arc = d3.arc()
        .innerRadius(30)
        .outerRadius(60)
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    const colorSegments = [
        { startAngle: -Math.PI / 2, endAngle: ((29 - 25) / 25) * Math.PI - Math.PI / 2, color: 'rgba(255, 0, 0, 0.2)' },
        { startAngle: ((29 - 25) / 25) * Math.PI - Math.PI / 2, endAngle: ((35 - 25) / 25) * Math.PI - Math.PI / 2, color: 'rgba(255, 0, 0, 0.4)' },
        { startAngle: ((35 - 25) / 25) * Math.PI - Math.PI / 2, endAngle: ((41 - 25) / 25) * Math.PI - Math.PI / 2, color: 'rgba(255, 0, 0, 0.6)' },
        { startAngle: ((41 - 25) / 25) * Math.PI - Math.PI / 2, endAngle: ((46 - 25) / 25) * Math.PI - Math.PI / 2, color: 'rgba(255, 0, 0, 0.8)' },
        { startAngle: ((46 - 25) / 25) * Math.PI - Math.PI / 2, endAngle: Math.PI / 2, color: 'rgba(255, 0, 0, 1)' }
    ];

    colorSegments.forEach(segment => {
        svg.append('path')
            .datum(segment)
            .attr('d', d3.arc()
                .innerRadius(30)
                .outerRadius(60)
                .startAngle(segment.startAngle)
                .endAngle(segment.endAngle))
            .attr('transform', 'translate(75, 75)')
            .attr('fill', segment.color);
    });

    const ticks = [29, 35, 41, 46];
    const radiusOuter = 62;
    const radiusInner = 25;
    ticks.forEach(tickValue => {
        const angle = ((tickValue - 25) / 25) * Math.PI - Math.PI / 2;
        const xOuter = 75 + radiusOuter * Math.cos(angle - Math.PI / 2);
        const yOuter = 75 + radiusOuter * Math.sin(angle - Math.PI / 2);
        const xInner = 75 + radiusInner * Math.cos(angle - Math.PI / 2);
        const yInner = 75 + radiusInner * Math.sin(angle - Math.PI / 2);

        svg.append('line')
            .attr('x1', xOuter)
            .attr('y1', yOuter)
            .attr('x2', xInner)
            .attr('y2', yInner)
            .attr('class', 'chart-tick-stroke');

        const xLabel = 75 + (radiusInner + 40) * Math.cos(angle - Math.PI / 2);
        const yLabel = 75 + (radiusInner + 40) * Math.sin(angle - Math.PI / 2);
        svg.append('text')
            .attr('x', xLabel)
            .attr('y', yLabel)
            .attr('class', 'chart-gauge-tick-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '6px')
            .text(tickValue);
    });

    const pointerAngle = Math.max(-Math.PI / 2, Math.min(((selectedValue - 25) / 25) * Math.PI - Math.PI / 2, Math.PI / 2));
    const pointerLength = 50;
    svg.append('line')
        .attr('x1', 75)
        .attr('y1', 75)
        .attr('x2', 75 + pointerLength * Math.cos(pointerAngle - Math.PI / 2))
        .attr('y2', 75 + pointerLength * Math.sin(pointerAngle - Math.PI / 2))
        .attr('class', 'chart-pointer-stroke');

    svg.append('circle')
        .attr('cx', 75)
        .attr('cy', 75)
        .attr('r', 4)
        .attr('class', 'chart-pointer-stroke');
}

function applyStreetInteractions() {
    streetLayer.eachLayer(function (layer) {
        addStreetInteractions(layer);
    });
}

map.on('layeradd', function (e) {
    if (e.layer === streetLayer) {
        applyStreetInteractions();
    }
});

function closeInfoBox() {
    document.getElementById('info-box').style.display = 'none';
}

