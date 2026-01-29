/**
 * Kalp Hastalığı Risk Değerlendirme Asistanı - Ana Uygulama
 * XGBoost modeli ve Gemini AI entegrasyonu
 */

// Global değişkenler
let heartModel = null;
let geminiService = null;

// DOM Elementleri
const form = document.getElementById('riskForm');
const formSection = document.getElementById('formSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const submitBtn = document.getElementById('submitBtn');
const newAssessmentBtn = document.getElementById('newAssessmentBtn');

// Sonuç elementleri
const riskScoreValue = document.getElementById('riskScoreValue');
const riskBadge = document.getElementById('riskBadge');
const factorsList = document.getElementById('factorsList');
const aiExplanation = document.getElementById('aiExplanation');

/**
 * Uygulamayı başlatır
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('❤️ Kalp Hastalığı Risk Değerlendirme başlatılıyor...');

    // Model ve servisleri başlat
    initializeModel();
    initializeServices();

    // Event listener'ları ayarla
    setupEventListeners();

    console.log('✅ Uygulama hazır');
});

/**
 * XGBoost modelini başlatır ve eğitir
 */
function initializeModel() {
    try {
        heartModel = new HeartRiskModel();

        // Eğitim verilerini kontrol et ve modeli eğit
        if (typeof HEART_TRAINING_DATA !== 'undefined') {
            heartModel.train(HEART_TRAINING_DATA);
            console.log(`📊 Model ${HEART_TRAINING_DATA.length} örnek ile eğitildi`);
        } else {
            console.error('❌ Eğitim verileri bulunamadı!');
        }
    } catch (error) {
        console.error('❌ Model başlatma hatası:', error);
    }
}

/**
 * Gemini servisini başlatır
 */
function initializeServices() {
    try {
        geminiService = new GeminiService();
        console.log('🤖 Gemini servisi hazır');
    } catch (error) {
        console.error('❌ Servis başlatma hatası:', error);
    }
}

/**
 * Event listener'ları ayarlar
 */
function setupEventListeners() {
    // Form gönderimi
    form.addEventListener('submit', handleFormSubmit);

    // Yeni değerlendirme butonu
    newAssessmentBtn.addEventListener('click', resetForm);

    // Input validasyonu
    setupValidation();
}

/**
 * Form validasyonunu ayarlar
 */
function setupValidation() {
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateInput(input));
        input.addEventListener('input', () => clearError(input));
    });
}

/**
 * Input validasyonu yapar
 */
function validateInput(input) {
    const formGroup = input.closest('.form-group');

    if (input.hasAttribute('required') && !input.value) {
        formGroup.classList.add('error');
        return false;
    }

    if (input.type === 'number') {
        const value = parseFloat(input.value);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);

        if (value < min || value > max) {
            formGroup.classList.add('error');
            return false;
        }
    }

    formGroup.classList.remove('error');
    return true;
}

/**
 * Hata durumunu temizler
 */
function clearError(input) {
    const formGroup = input.closest('.form-group');
    formGroup.classList.remove('error');
}

/**
 * Form gönderimini işler
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    // Form validasyonu
    if (!validateForm()) {
        return;
    }

    // Form verilerini al
    const formData = getHeartFormData();
    console.log('📋 Form verileri:', formData);

    // Yükleme durumunu göster
    showLoading();

    try {
        // Risk değerlendirmesi yap
        const riskResult = await assessHeartRisk(formData);
        console.log('🎯 Risk sonucu:', riskResult);

        // AI açıklaması al
        const explanation = await getAIExplanation(riskResult);

        // Sonuçları göster
        displayResults(riskResult, explanation);

    } catch (error) {
        console.error('❌ Değerlendirme hatası:', error);
        showError('Değerlendirme yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

/**
 * Form validasyonu yapar
 */
function validateForm() {
    const requiredInputs = form.querySelectorAll('[required]');
    let isValid = true;

    requiredInputs.forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Form verilerini Heart.csv formatına göre alır
 */
function getHeartFormData() {
    const formData = new FormData(form);

    return {
        age: parseInt(formData.get('age')),
        sex: parseInt(formData.get('sex')),
        cp: parseInt(formData.get('cp')),
        trestbps: parseInt(formData.get('trestbps')),
        chol: parseInt(formData.get('chol')),
        fbs: parseInt(formData.get('fbs')),
        restecg: parseInt(formData.get('restecg')),
        thalach: parseInt(formData.get('thalach')),
        exang: parseInt(formData.get('exang')),
        oldpeak: parseFloat(formData.get('oldpeak')),
        slope: parseInt(formData.get('slope')),
        ca: parseInt(formData.get('ca')),
        thal: parseInt(formData.get('thal'))
    };
}

/**
 * Kalp hastalığı risk değerlendirmesi yapar
 */
async function assessHeartRisk(formData) {
    if (!heartModel) {
        throw new Error('Risk modeli hazır değil');
    }

    // Model tahmini yap
    const prediction = heartModel.predict(formData);

    return prediction;
}

/**
 * Gemini AI açıklaması alır
 */
async function getAIExplanation(riskResult) {
    if (!geminiService) {
        // Yerel açıklama üret
        return generateLocalExplanation(riskResult);
    }

    try {
        const explanation = await geminiService.generateExplanation(riskResult);
        return explanation;
    } catch (error) {
        console.warn('Gemini API hatası, yerel açıklama kullanılıyor:', error);
        return generateLocalExplanation(riskResult);
    }
}

/**
 * Yerel açıklama üretir (Gemini API yoksa)
 */
function generateLocalExplanation(riskResult) {
    const seviye = riskResult.riskLevel;
    const skor = riskResult.riskScore;
    const etkenler = riskResult.factors || [];

    let aciklama = '';

    // Giriş
    if (seviye === 'düşük') {
        aciklama = `Girdiğiniz bilgilere göre kalp hastalığı risk seviyeniz **düşük** (%${skor}). Bu genellikle iyi bir haber. `;
    } else if (seviye === 'orta') {
        aciklama = `Girdiğiniz bilgilere göre kalp hastalığı risk seviyeniz **orta** (%${skor}). Dikkatli olmakta fayda var. `;
    } else {
        aciklama = `Girdiğiniz bilgilere göre kalp hastalığı risk seviyeniz **yüksek** (%${skor}). Bu durumu ciddiye almanız önemli. `;
    }

    // Risk etkenleri analizi
    const riskliEtkenler = etkenler.filter(e =>
        e.includes('risk') ||
        e.includes('yüksek') ||
        e.includes('anormal')
    );
    const olumluEtkenler = etkenler.filter(e =>
        e.includes('normal') ||
        e.includes('iyi') ||
        e.includes('olumlu')
    );

    if (riskliEtkenler.length > 0) {
        aciklama += '\n\n**Dikkat Çeken Faktörler:**\n';
        riskliEtkenler.slice(0, 4).forEach(etken => {
            aciklama += `- ${etken}\n`;
        });
    }

    if (olumluEtkenler.length > 0) {
        aciklama += '\n**Olumlu Faktörler:**\n';
        olumluEtkenler.slice(0, 3).forEach(etken => {
            aciklama += `- ${etken}\n`;
        });
    }

    // Öneri
    aciklama += '\n\n**Öneri:** ';
    if (seviye === 'düşük') {
        aciklama += 'Kalp sağlığınız iyi görünüyor. Düzenli egzersiz, sağlıklı beslenme ve yıllık kontrolleri sürdürmeyi unutmayın.';
    } else if (seviye === 'orta') {
        aciklama += 'Risk faktörleriniz orta düzeyde. Bir kardiyolog ile görüşmenizi öneririm. Yaşam tarzı değişiklikleri faydalı olabilir.';
    } else {
        aciklama += 'Risk faktörleriniz yüksek. En kısa sürede bir kardiyologa başvurmanız önemle tavsiye edilir.';
    }

    // Yasal uyarı
    aciklama += '\n\n*Not: Bu değerlendirme bilgilendirme amaçlıdır ve tıbbi teşhis/tedavi yerine geçmez. Acil bir durumunuz varsa 112\'yi arayın veya en yakın sağlık kuruluşuna başvurun.*';

    return aciklama;
}

/**
 * Sonuçları ekranda gösterir
 */
function displayResults(riskResult, explanation) {
    // Risk skorunu güncelle
    riskScoreValue.textContent = `%${riskResult.riskScore}`;
    riskScoreValue.className = `risk-score-value ${riskResult.riskLevel}`;

    // Risk badge'ini güncelle
    const seviyeText = riskResult.riskLevel === 'düşük' ? 'Düşük Risk' :
                       riskResult.riskLevel === 'orta' ? 'Orta Risk' : 'Yüksek Risk';
    riskBadge.textContent = seviyeText;
    riskBadge.className = `risk-badge ${riskResult.riskLevel}`;

    // Etkenleri listele
    factorsList.innerHTML = '';
    if (riskResult.factors && riskResult.factors.length > 0) {
        riskResult.factors.forEach(factor => {
            const li = document.createElement('li');
            li.textContent = factor;
            factorsList.appendChild(li);
        });
    }

    // AI açıklamasını güncelle
    aiExplanation.textContent = explanation;

    // Sonuç bölümünü göster
    hideLoading();
    resultsSection.classList.add('active');

    // Sayfayı sonuçlara kaydır
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Yükleme durumunu gösterir
 */
function showLoading() {
    formSection.style.display = 'none';
    resultsSection.classList.remove('active');
    loadingSection.classList.add('active');
}

/**
 * Yükleme durumunu gizler
 */
function hideLoading() {
    loadingSection.classList.remove('active');
}

/**
 * Formu sıfırlar
 */
function resetForm() {
    form.reset();
    formSection.style.display = 'block';
    resultsSection.classList.remove('active');

    // Sayfayı yukarı kaydır
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Hata mesajı gösterir
 */
function showError(message) {
    hideLoading();
    formSection.style.display = 'block';

    // Basit alert (gelişmiş hata yönetimi eklenebilir)
    alert(message);
}

// Hata yakalama
window.onerror = function(message, source, lineno, colno, error) {
    console.error('🐛 Uygulama hatası:', { message, source, lineno, colno, error });
    return false;
};
