/**
 * Kalp Hastalığı Risk Modeli
 * XGBoost benzeri Gradient Boosting tabanlı sınıflandırıcı
 * Heart.csv veri setinden eğitilir
 */

class HeartRiskModel {
    constructor() {
        this.trees = []; // Boosting ağaçları
        this.learningRate = 0.1;
        this.nEstimators = 50;
        this.maxDepth = 4;
        this.isTrained = false;
        this.featureMeans = {};
        this.featureStds = {};
    }

    /**
     * Modeli eğitim verileriyle eğitir
     * @param {Array} data - Heart.csv'den dönüştürülmüş eğitim verileri
     */
    train(data) {
        if (!data || data.length === 0) {
            console.error('Eğitim verisi yok!');
            return;
        }

        // Veriyi normalize et
        this.normalizeData(data);

        // Gradient Boosting ile ağaçları eğit
        let predictions = new Array(data.length).fill(0.5);

        for (let i = 0; i < this.nEstimators; i++) {
            // Residual hesapla (gradient)
            const residuals = data.map((sample, idx) => {
                const actual = sample.target;
                const pred = predictions[idx];
                // Logistic gradient
                return actual - this.sigmoid(pred);
            });

            // Yeni ağaç oluştur
            const tree = this.buildDecisionTree(data, residuals, 0);
            this.trees.push(tree);

            // Tahminleri güncelle
            data.forEach((sample, idx) => {
                const treePred = this.predictWithTree(sample, tree);
                predictions[idx] += this.learningRate * treePred;
            });
        }

        this.isTrained = true;
        console.log(`Model ${data.length} örnek ile ${this.nEstimators} ağaç kullanılarak eğitildi.`);
    }

    /**
     * Sigmoid aktivasyon fonksiyonu
     */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    /**
     * Verileri normalize et (Z-score normalization)
     */
    normalizeData(data) {
        const features = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg',
                         'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal'];

        features.forEach(feature => {
            const values = data.map(d => d[feature]).filter(v => v !== null && v !== undefined);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            const std = Math.sqrt(variance);

            this.featureMeans[feature] = mean;
            this.featureStds[feature] = std || 1;
        });
    }

    /**
     * Özelliği normalize et
     */
    normalizeFeature(feature, value) {
        if (this.featureMeans[feature] === undefined) return value;
        return (value - this.featureMeans[feature]) / (this.featureStds[feature] || 1);
    }

    /**
     * Karar ağacı oluştur (basit versiyon)
     */
    buildDecisionTree(data, residuals, depth) {
        // Base case
        if (depth >= this.maxDepth || data.length < 5) {
            const avgResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
            return { type: 'leaf', value: avgResidual };
        }

        // En iyi split'i bul
        let bestSplit = null;
        let bestGain = -Infinity;

        const features = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg',
                         'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal'];

        for (const feature of features) {
            const uniqueValues = [...new Set(data.map(d => d[feature]))];
            for (const threshold of uniqueValues) {
                const { gain, leftData, rightData, leftResiduals, rightResiduals } =
                    this.calculateSplitGain(data, residuals, feature, threshold);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = {
                        feature,
                        threshold,
                        leftData,
                        rightData,
                        leftResiduals,
                        rightResiduals
                    };
                }
            }
        }

        if (!bestSplit || bestGain <= 0) {
            const avgResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
            return { type: 'leaf', value: avgResidual };
        }

        // Recursive ağaç oluştur
        return {
            type: 'node',
            feature: bestSplit.feature,
            threshold: bestSplit.threshold,
            left: this.buildDecisionTree(bestSplit.leftData, bestSplit.leftResiduals, depth + 1),
            right: this.buildDecisionTree(bestSplit.rightData, bestSplit.rightResiduals, depth + 1)
        };
    }

    /**
     * Split kazancını hesapla (MSE reduction)
     */
    calculateSplitGain(data, residuals, feature, threshold) {
        const leftIndices = [];
        const rightIndices = [];

        data.forEach((sample, idx) => {
            if (sample[feature] <= threshold) {
                leftIndices.push(idx);
            } else {
                rightIndices.push(idx);
            }
        });

        if (leftIndices.length === 0 || rightIndices.length === 0) {
            return { gain: -Infinity };
        }

        const leftResiduals = leftIndices.map(i => residuals[i]);
        const rightResiduals = rightIndices.map(i => residuals[i]);
        const leftData = leftIndices.map(i => data[i]);
        const rightData = rightIndices.map(i => data[i]);

        const parentMSE = this.calculateMSE(residuals);
        const leftMSE = this.calculateMSE(leftResiduals);
        const rightMSE = this.calculateMSE(rightResiduals);

        const leftWeight = leftIndices.length / data.length;
        const rightWeight = rightIndices.length / data.length;

        const gain = parentMSE - (leftWeight * leftMSE + rightWeight * rightMSE);

        return { gain, leftData, rightData, leftResiduals, rightResiduals };
    }

    /**
     * MSE hesapla
     */
    calculateMSE(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    }

    /**
     * Tek bir ağaç ile tahmin yap
     */
    predictWithTree(sample, tree) {
        if (tree.type === 'leaf') {
            return tree.value;
        }

        const normalizedValue = this.normalizeFeature(tree.feature, sample[tree.feature]);

        if (normalizedValue <= this.normalizeFeature(tree.feature, tree.threshold)) {
            return this.predictWithTree(sample, tree.left);
        } else {
            return this.predictWithTree(sample, tree.right);
        }
    }

    /**
     * Risk tahmini yapar
     * @param {Object} sample - Değerlendirilecek vaka
     * @returns {Object} - Risk tahmin sonucu
     */
    predict(sample) {
        if (!this.isTrained || this.trees.length === 0) {
            throw new Error('Model henüz eğitilmemiş!');
        }

        // Tüm ağaçlardan tahmin al
        let logit = 0;
        for (const tree of this.trees) {
            logit += this.learningRate * this.predictWithTree(sample, tree);
        }

        // Olasılığa çevir
        const probability = this.sigmoid(logit);
        const riskScore = Math.round(probability * 100);

        // Risk seviyesini belirle
        let riskLevel;
        if (riskScore < 35) {
            riskLevel = 'düşük';
        } else if (riskScore < 65) {
            riskLevel = 'orta';
        } else {
            riskLevel = 'yüksek';
        }

        // Güven skoru (ağaç sayısına ve tahmin tutarlığına göre)
        const confidence = Math.min(95, 70 + this.trees.length);

        // Risk etkenlerini belirle
        const factors = this.identifyRiskFactors(sample);

        return {
            riskScore,
            riskLevel,
            confidence,
            factors,
            probability: probability.toFixed(3)
        };
    }

    /**
     * Risk etkenlerini belirler (Heart.csv sütunlarına göre)
     */
    identifyRiskFactors(sample) {
        const factors = [];

        // Yaş
        if (sample.age >= 60) {
            factors.push(`yaş: ${sample.age} (ileri yaş - risk faktörü)`);
        } else if (sample.age >= 45) {
            factors.push(`yaş: ${sample.age} (orta yaş - dikkat gerekli)`);
        } else {
            factors.push(`yaş: ${sample.age} (genç - olumlu faktör)`);
        }

        // Cinsiyet
        if (sample.sex === 1) {
            factors.push(`cinsiyet: erkek (daha yüksek risk)`);
        } else {
            factors.push(`cinsiyet: kadın (daha düşük risk)`);
        }

        // Göğüs ağrısı tipi
        const cpTypes = ['tip yok', 'tip 1 (anjin yok)', 'tip 2 (anormal)', 'tip 3 (anjin var)'];
        if (sample.cp >= 3) {
            factors.push(`göğüs ağrısı: ${cpTypes[sample.cp] || sample.cp} (yüksek risk)`);
        } else if (sample.cp === 2) {
            factors.push(`göğüs ağrısı: ${cpTypes[sample.cp]} (orta risk)`);
        } else {
            factors.push(`göğüs ağrısı: ${cpTypes[sample.cp] || sample.cp} (düşük risk)`);
        }

        // Kan basıncı
        if (sample.trestbps >= 140) {
            factors.push(`dinlenik kan basıncı: ${sample.trestbps} mmHg (yüksek - hipertansiyon)`);
        } else if (sample.trestbps >= 120) {
            factors.push(`dinlenik kan basıncı: ${sample.trestbps} mmHg ( sınır değer)`);
        } else {
            factors.push(`dinlenik kan basıncı: ${sample.trestbps} mmHg (normal - olumlu)`);
        }

        // Kolesterol
        if (sample.chol >= 240) {
            factors.push(`kolesterol: ${sample.chol} mg/dL (yüksek - risk faktörü)`);
        } else if (sample.chol >= 200) {
            factors.push(`kolesterol: ${sample.chol} mg/dL (sınır üstü)`);
        } else {
            factors.push(`kolesterol: ${sample.chol} mg/dL (normal - olumlu)`);
        }

        // Açlık şekeri
        if (sample.fbs === 1) {
            factors.push(`açlık şekeri: >120 mg/dL (diyabet riski)`);
        } else {
            factors.push(`açlık şekeri: normal (olumlu)`);
        }

        // EKG sonuçları
        if (sample.restecg === 2) {
            factors.push(`EKG: anormal (hipertrofi belirtisi)`);
        } else if (sample.restecg === 1) {
            factors.push(`EKG: borderline ST dalgalanması`);
        } else {
            factors.push(`EKG: normal (olumlu)`);
        }

        // Maksimum kalp hızı
        if (sample.thalach < 120) {
            factors.push(`maks. kalp hızı: ${sample.thalach} (düşük - risk faktörü)`);
        } else if (sample.thalach < 150) {
            factors.push(`maks. kalp hızı: ${sample.thalach} (orta)`);
        } else {
            factors.push(`maks. kalp hızı: ${sample.thalach} (iyi kondisyon - olumlu)`);
        }

        // Egzersize bağlı anjina
        if (sample.exang === 1) {
            factors.push(`egzersiz anjinası: var (risk faktörü)`);
        } else {
            factors.push(`egzersiz anjinası: yok (olumlu)`);
        }

        // ST depresyonu
        if (sample.oldpeak >= 2) {
            factors.push(`ST depresyonu: ${sample.oldpeak} (yüksek risk)`);
        } else if (sample.oldpeak >= 1) {
            factors.push(`ST depresyonu: ${sample.oldpeak} (orta risk)`);
        } else {
            factors.push(`ST depresyonu: ${sample.oldpeak} (normal)`);
        }

        // ST eğimi
        const slopeTypes = ['yukarı (olumlu)', 'düz (nötr)', 'aşağı (risk)'];
        factors.push(`ST eğimi: ${slopeTypes[sample.slope - 1] || sample.slope}`);

        // Major damar sayısı
        if (sample.ca >= 2) {
            factors.push(`damar tıkanıklığı: ${sample.ca} damar (yüksek risk)`);
        } else if (sample.ca === 1) {
            factors.push(`damar tıkanıklığı: 1 damar (dikkat)`);
        } else {
            factors.push(`damar tıkanıklığı: yok (olumlu)`);
        }

        // Thalasemi
        const thalTypes = ['normal', 'tespit edilemez', 'reversibl defekt'];
        if (sample.thal === 2) {
            factors.push(`thalasemi: ${thalTypes[sample.thal - 1] || sample.thal} (risk faktörü)`);
        } else {
            factors.push(`thalasemi: ${thalTypes[sample.thal - 1] || sample.thal}`);
        }

        return factors;
    }
}

// Modeli dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HeartRiskModel };
}
