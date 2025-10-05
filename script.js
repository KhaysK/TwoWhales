document.addEventListener('DOMContentLoaded', function() {
    const contractSelect = document.getElementById('contract');
    const initialPaymentInput = document.getElementById('initial_payment');
    const installmentPeriodInput = document.getElementById('installment_period');
    const birthdateInput = document.getElementById('birthdate');
    const passportIssueDate = document.getElementById('passport_issue_date');

    function setDateLimits() {
        const today = new Date();
        const maxDate = new Date(today); // Сегодняшняя дата
        const minDate = new Date(today);
        minDate.setFullYear(today.getFullYear() - 100); // 100 лет назад
        
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        birthdateInput.max = formatDate(maxDate);
        birthdateInput.min = formatDate(minDate);
        passportIssueDate.max = formatDate(maxDate);
        passportIssueDate.min = formatDate(minDate);
    }
    
    setDateLimits();

    function updatePaymentFields() {
        if (contractSelect.value === 'cash') {
            // Для "налички" - дизейблим и очищаем поля
            initialPaymentInput.disabled = true;
            installmentPeriodInput.disabled = true;
            initialPaymentInput.value = '';
            installmentPeriodInput.value = '';
        } else if (contractSelect.value === 'installment') {
            // Для "рассрочки" - включаем поля
            initialPaymentInput.disabled = false;
            installmentPeriodInput.disabled = false;
        }
    }

    updatePaymentFields();

    contractSelect.addEventListener('change', updatePaymentFields);

    const submitBtn = document.getElementById('submit');
    const graphBtn = document.getElementById('graph');

    submitBtn.addEventListener('click', function(event) {
        event.preventDefault(); 
        const form = document.querySelector('form');
    
        if (form.checkValidity()) {
            generateContract();
        } else {
            form.reportValidity();
        }
    });

    graphBtn.addEventListener('click', function(event) {
        event.preventDefault(); 
        displayPaymentPreview();
    });

    Inputmask({
        mask: '+7 (999) 999-99-99',
        placeholder: '_',
        showMaskOnHover: true,
        showMaskOnFocus: true
    }).mask(document.getElementById('phone_number'));
});

async function generateContract() {
    try {
        // 1. Собираем данные из формы
        const formData = collectFormData();
        console.log(formData);
        // 2. Загружаем и заполняем DOCX шаблон
        const docxBuffer = await fillDocxTemplate(formData);

        // 3. Конвертируем DOCX в PDF
        const pdfBlob = await convertDocxToPdf(docxBuffer);

        // 4. Скачиваем PDF
        downloadFile(pdfBlob, 'договор.docx');

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при генерации документа');
    }
}

// Сбор данных из формы
function collectFormData() {
    const total_area = Number(document.getElementById('total_area').value);
    const pricePerSquare = Number(document.getElementById('price_per_square').value);
    const initial_payment = Number(document.getElementById('initial_payment').value);
    const totalPrice = pricePerSquare * total_area;
    const initialPaymentPercent = calculateInitialPaymentPercent(totalPrice, initial_payment);
    
    return {
        isCashContract: document.getElementById('contract').value === "cash",
        fullname: document.getElementById('fullname').value,
        shortname: getShortName(document.getElementById('fullname').value),
        birthdate: formatDate(document.getElementById('birthdate').value),
        phone_number: document.getElementById('phone_number').value,
        passport: document.getElementById('passport').value,
        passport_issue_date: formatDate(document.getElementById('passport_issue_date').value),
        passport_issued_by: document.getElementById('passport_issued_by').value,
        passport_division_code: document.getElementById('passport_division_code').value,
        registration_address: document.getElementById('registration_address').value,
        building: document.getElementById('building').value,
        construction_number: document.getElementById('construction_number').value,
        floor: document.getElementById('floor').value,
        rooms: document.getElementById('rooms').value,
        installment_period: document.getElementById('installment_period').value,
        price_per_square: formatNumberWithSpaces(pricePerSquare),
        area: document.getElementById('area').value,
        initial_payment: formatNumberWithSpaces(initial_payment),
        initial_payment_percent: initialPaymentPercent,
        price: formatNumberWithSpaces(totalPrice),
        
        current_date: formatDate(document.getElementById('current_date').value, true),
    };
}

// Заполнение DOCX шаблона
async function fillDocxTemplate(data) {
    const paymentData = data.isCashContract ? {} : getPaymentDataForWord();

    const response = await fetch(data.isCashContract ? 'template.docx' : 'template-installment.docx');
    const templateBuffer = await response.arrayBuffer();
    
    const zip = new PizZip(templateBuffer);

    const doc = new docxtemplater(zip, {paragraphLoop: true, linebreaks: true});
    console.log('paymentData', paymentData)
    // Заполняем шаблон данными
    const documentData = {
        ...data,
        ...paymentData
    };
    doc.render(documentData);
    
    // Генерируем заполненный DOCX
    return doc.getZip().generate({type: 'arraybuffer'});
}

// Скачивание файла
function downloadFile(blob, fileName) {
    saveAs(blob, fileName);
}

function formatDate(dateString, isLong = false) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    if (isLong) {
        // Длинный формат: "22 Сентября 2025г."
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();
        
        const monthNames = [
            'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
            'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
        ];
        
        return `${day} ${monthNames[month]} ${year}г.`;
    } else {
        // Короткий формат: "22.09.2025"
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        
        return `${day}.${month}.${year}`;
    }
}

// Функция для форматирования валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
}

function calculateInitialPaymentPercent(totalPrice, initialPayment) {
    if (totalPrice <= 0 || initialPayment <= 0) return 0;
    
    const percent = (initialPayment / totalPrice) * 100;
    return Math.ceil(percent);
}

async function convertDocxToPdf(docxBuffer) {
    return new Blob([docxBuffer], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

function formatNumberWithSpaces(number) {
    return new Intl.NumberFormat('ru-RU').format(number);
}

function getShortName(fullName) {
    if (!fullName) return '';
    
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length < 2) return fullName; 
    
    const lastName = parts[0];
    
    const initials = parts.slice(1)
        .map(name => name.charAt(0) + '.')
        .join(' ');
    
    return `${lastName} ${initials}`;
}

function displayPaymentPreview() {
    const contractType = document.getElementById('contract').value;
    const installmentPeriod = parseInt(document.getElementById('installment_period').value) || 0;
    
    if (contractType === 'installment' && installmentPeriod > 0) {
        const initialPayment = parseFloat(document.getElementById('initial_payment').value) || 0;
        const pricePerSquare = parseFloat(document.getElementById('price_per_square').value) || 0;
        const totalArea = parseFloat(document.getElementById('total_area').value) || 0;
        const currentDate = document.getElementById('current_date').value;
        
        const payments = generatePaymentTable(initialPayment, pricePerSquare, totalArea, installmentPeriod, currentDate);
        
        // Показываем превью таблицы на странице
        const previewContainer = document.getElementById('payment-preview');
        if (previewContainer) {
            previewContainer.innerHTML = createPaymentTableHTML(payments);
        }
    }
}

function generatePaymentTable(initialPayment, pricePerSquare, totalArea, installmentPeriod, currentDate) {
    const totalPrice = pricePerSquare * totalArea;
    const installmentAmount = totalPrice - initialPayment;    
    const monthlyPayment = Math.round(installmentAmount / installmentPeriod);
    const payments = [];
    let remainingAmount = installmentAmount;
    const firstPaymentDate = new Date(currentDate);

    payments.push({
        number: 1,
        payment: formatCurrency(initialPayment),
        date: formatDate(firstPaymentDate),
        remaining: formatCurrency(installmentAmount)
    });
    
    if (new Date(currentDate).getDate() > 15) {
        // Если дата > 15 числа, первый платеж 1 числа через месяц
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 2);
        firstPaymentDate.setDate(1);
    } else {
        // Если дата <= 15 числа, первый платеж 1 числа следующего месяца
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
        firstPaymentDate.setDate(1);
    }

    for (let i = 0; i < installmentPeriod; i++) {
        const paymentDate = new Date(firstPaymentDate);
        paymentDate.setMonth(firstPaymentDate.getMonth() + i);
        
        // Форматируем дату в DD.MM.YYYY
        const formattedDate = formatDate(paymentDate);
        
        if (i === installmentPeriod - 1) {
            const lastPayment = remainingAmount;
            payments.push({
                number: i + 2,
                payment: formatCurrency(lastPayment),
                date: formattedDate,
                remaining: '0'
            });
        } else {
            remainingAmount -= monthlyPayment;
            
            payments.push({
                number: i + 2,
                payment: formatCurrency(monthlyPayment),
                date: formattedDate,
                remaining: formatCurrency(Math.max(0, remainingAmount))
            });
        }
    }
    
    return payments;
}

function createPaymentTableHTML(payments) {
    if (!payments || payments.length === 0) return '';
    
    let tableHTML = `
        <div style="margin-top: 40px; page-break-before: always;">
            <h3>График платежей</h3>
            <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="text-align: center; padding: 10px;">№ п/п</th>
                        <th style="text-align: center; padding: 10px;">Платеж (руб)</th>
                        <th style="text-align: center; padding: 10px;">Дата платежа</th>
                        <th style="text-align: center; padding: 10px;">Остаток (руб)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    payments.forEach(payment => {
        tableHTML += `
            <tr>
                <td style="text-align: center; padding: 8px;">${payment.number}</td>
                <td style="text-align: right; padding: 8px;">${payment.payment}</td>
                <td style="text-align: center; padding: 8px;">${payment.date}</td>
                <td style="text-align: right; padding: 8px;">${payment.remaining}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return tableHTML;
}

function getPaymentDataForWord() {
    const installmentPeriod = parseInt(document.getElementById('installment_period').value) || 0;

    const initialPayment = parseFloat(document.getElementById('initial_payment').value) || 0;
    const pricePerSquare = parseFloat(document.getElementById('price_per_square').value) || 0;
    const totalArea = parseFloat(document.getElementById('total_area').value) || 0;
    const currentDate = document.getElementById('current_date').value;
    const payments = generatePaymentTable(initialPayment, pricePerSquare, totalArea, installmentPeriod, currentDate);

    const paymentTable = payments.map(payment => ({
        number: payment.number.toString(),
        payment: payment.payment,
        date: payment.date,
        remaining: payment.remaining
    }));
    
    return {
        paymentTable: paymentTable,
    };
}