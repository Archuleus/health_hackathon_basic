/**
 * Gemini Servisi
 * Risk değerlendirme sonuçlarını Google Gemini API üzerinden
 * insani ve anlaşılır bir dile çevirir
 */


    /**
     * Risk sonuçlarını Gemini'ye göndererek insani açıklama alır
     * @param {Object} riskResult - Risk modelinden gelen sonuç
     * @returns {Promise<string>} - Gemini tarafından üretilen açıklama
     */
    async generateExplanation(riskResult) {
        // Prompt'u hazırla
        const prompt = this.buildPrompt(riskResult);

        try {
            // Gemini API'ye istek gönder
            const url = `${this.apiEndpoint}?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API hatası:', errorData);
                throw new Error(`API hatası: ${response.status}`);
            }

            const data = await response.json();
            console.log('Gemini tam API yanıtı:', JSON.stringify(data, null, 2));

            // Farklı yanıt formatlarını kontrol et
            if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];

                // Format 1: content.parts[0].text
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                    const text = candidate.content.parts[0].text;
                    if (text) {
                        console.log('Alınan metin uzunluğu:', text.length);
                        return text;
                    }
                }

                // Format 2: text doğrudan
                if (candidate.text) {
                    return candidate.text;
                }
            }

            console.warn('API yanıt formatı beklenmedik, yerel açıklama kullanılıyor');
            return this.generateLocalExplanation(riskResult);

        } catch (error) {
            console.warn('Gemini API hatası, yerel açıklama kullanılıyor:', error);
            return this.generateLocalExplanation(riskResult);
        }
    }

    /**
     * Gemini için prompt oluşturur
     * @param {Object} riskResult - Risk sonuçları
     * @returns {string} - Prompt metni
     */
    buildPrompt(riskResult) {
        const seviye = riskResult.riskLevel.toUpperCase();
        const skor = riskResult.riskScore;
        const etkenler = riskResult.factors ? riskResult.factors.join('\n- ') : 'Veri mevcut değil';

        // Prompt'u sadeleştir - faktörleri 5 ile sınırla
        const factorsLimited = riskResult.factors ? riskResult.factors.slice(0, 5).join(', ') : 'yok';

        return `Kalp hastalığı risk analizi: ${seviye} seviye, %${skor} risk.
Faktörler: ${factorsLimited}.
Kısa Türkçe açıklama yaz:`;
    }

    /**
     * API anahtarı olmadığında yerel açıklama üretir
     * @param {Object} riskResult - Risk sonuçları
     * @returns {string} - Yerel açıklama
     */
    generateLocalExplanation(riskResult) {
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
            (e.includes('var') && !e.includes('yok')) ||
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
            riskliEtkenler.slice(0, 3).forEach(etken => {
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
            aciklama += 'Kalp sağlığınız iyi görünüyor. Düzenli egzersiz, sağlıklı beslenme ve kontrolleri sürdürmeyi unutmayın.';
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
     * API anahtarını günceller
     * @param {string} apiKey - Yeni API anahtarı
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
}

// Servisi dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeminiService };
}
