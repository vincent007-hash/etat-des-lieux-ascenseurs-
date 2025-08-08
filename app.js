// Application state
let currentSection = 0;
let formData = {};
let completedSections = new Set();
let autoSaveTimer = null;
let sectionPhotos = {};

// DOM elements
let sections, navButtons, nextBtn, generatePDFBtn, newInspectionBtn, progressBar, progressText, toast, form;

// Section IDs for easy reference
const sectionIds = [
    'identification', 'cabine', 'portes_palieres', 'porte_cabine', 'toit_cabine',
    'commande_securite', 'gaines_cuvette', 'contrepoids', 'local_machine', 
    'conclusion_observations', 'signatures'
];

// Required fields by section - Updated with correct field names
const requiredFieldsBySectionIndex = {
    0: ['adresse', 'numero_appareil', 'date_visite', 'nom_technicien'],
    1: ['etat_interieur', 'boutons_commande', 'eclairage', 'signalisation', 'nivellement'],
    2: ['type_porte', 'fonctionnement_portes', 'dispositifs_securite', 'alignement', 'proprete_rails'],
    3: ['etat_porte_cabine', 'mecanisme_ouverture', 'securite_porte_cabine'],
    4: ['etat_toit', 'acces_toit', 'equipements_toit'],
    5: ['manoeuvre_secours', 'parachute', 'fins_courses', 'alarme_telephone'],
    6: ['proprete_gaine', 'etat_cables', 'lubrification', 'poulie_tendeuse', 'cablette_limiteur', 'bouton_stop_cuvette'],
    7: ['contrepoids_etat', 'poulies_galets'],
    8: ['acces_securise', 'moteur_armoire', 'proprete_local', 'schemas_notices', 'boitier_rappel', 'differentiel_dtu', 'bloc_secours', 'kit_consignation', 'verrou_anti_panique', 'eclairage_machinerie'],
    9: [], // No required fields in observations section
    10: ['nom_technicien_final', 'signature_technicien', 'nom_client_final', 'signature_client']
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing...');
    initializeDOM();
    initializeApp();
});

function initializeDOM() {
    // Get DOM elements after page load
    sections = document.querySelectorAll('.section');
    navButtons = document.querySelectorAll('.nav-btn');
    nextBtn = document.getElementById('nextBtn');
    generatePDFBtn = document.getElementById('generatePDF');
    newInspectionBtn = document.getElementById('newInspection');
    progressBar = document.getElementById('progressBar');
    progressText = document.getElementById('progressText');
    toast = document.getElementById('toast');
    form = document.getElementById('elevatorForm');
    
    console.log('DOM elements initialized:', {
        sections: sections.length,
        navButtons: navButtons.length,
        form: !!form
    });
}

function initializeApp() {
    loadFormData();
    bindEvents();
    setupPhotoHandlers();
    setDefaultValues();
    updateUI();
    startAutoSave();
    
    console.log('App initialized successfully');
}

function setDefaultValues() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateField = document.getElementById('date_visite');
    if (dateField && !dateField.value) {
        dateField.value = today;
        formData['date_visite'] = today;
    }
}

// Event bindings
function bindEvents() {
    console.log('Binding events...');
    
    // Navigation buttons
    navButtons.forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Nav button clicked:', index);
            goToSection(index);
        });
    });
    
    // Next button
    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Next button clicked');
            nextSection();
        });
    }
    
    if (generatePDFBtn) {
        generatePDFBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            generatePDF();
        });
    }
    
    if (newInspectionBtn) {
        newInspectionBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            newInspection();
        });
    }
    
    // Form input handling
    if (form) {
        form.addEventListener('input', handleFormInput);
        form.addEventListener('change', handleFormInput);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Fonction simplifiée pour éviter l'erreur
        console.log('Touche pressée:', e.key);
    });
    
    // Auto-save on visibility change
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            saveFormData();
        }
    });
    
    // Save before page unload
    window.addEventListener('beforeunload', function() {
        saveFormData();
    });
    
    console.log('Events bound successfully');
}

// Photo handling setup
function setupPhotoHandlers() {
    console.log('Setting up photo handlers...');
    // Setup photo inputs for each section (sections 0-9 have photos, section 10 (signatures) doesn't)
    for (let i = 0; i < 10; i++) {
        const photoInput = document.getElementById(`photos-${i}`);
        if (photoInput) {
            console.log(`Setting up photo handler for section ${i}`);
            photoInput.addEventListener('change', function(e) {
                console.log(`Photo upload triggered for section ${i}`);
                handlePhotoUpload(e, i);
            });
        } else {
            console.warn(`Photo input not found for section ${i}`);
        }
        
        // Initialize photo storage for section
        if (!sectionPhotos[i]) {
            sectionPhotos[i] = [];
        }
    }
    console.log('Photo handlers setup complete');
}

// Handle photo upload - improved version
function handlePhotoUpload(event, sectionIndex) {
    console.log(`🔍 handlePhotoUpload called for section ${sectionIndex}`);
    const files = Array.from(event.target.files);
    const maxPhotos = 6;
    const currentPhotos = sectionPhotos[sectionIndex] || [];
    
    console.log(`🔍 Files selected: ${files.length}, current photos: ${currentPhotos.length}`);
    console.log(`🔍 sectionPhotos avant ajout:`, JSON.stringify(Object.keys(sectionPhotos)));
    
    // Vérifier que sectionPhotos[sectionIndex] est bien un tableau
    if (!Array.isArray(sectionPhotos[sectionIndex])) {
        console.warn(`⚠️ sectionPhotos[${sectionIndex}] n'est pas un tableau, initialisation...`);
        sectionPhotos[sectionIndex] = [];
    }
    
    if (currentPhotos.length + files.length > maxPhotos) {
        showToast(`Maximum ${maxPhotos} photos par section. Photos supplémentaires ignorées.`, 'warning');
        return;
    }
    
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            console.log(`🔍 Processing image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
            try {
                // Compresser l'image avant de la convertir en dataUrl
                compressImage(file).then(compressedBlob => {
                    console.log(`✅ Image compressée: ${compressedBlob.size} bytes (${Math.round(compressedBlob.size / file.size * 100)}% de l'original)`);
                    
                    // Convert file to base64 immediately for PDF compatibility
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const dataUrl = e.target.result;
                        console.log(`✅ DataURL généré pour ${file.name}, longueur: ${dataUrl.length} caractères`);
                        console.log(`✅ DataURL commence par: ${dataUrl.substring(0, 50)}...`);
                        
                        // Vérifier que le dataUrl est valide
                        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
                            console.error(`❌ DataURL invalide pour ${file.name}`);
                            showToast(`Erreur lors du traitement de l'image ${file.name}`, 'error');
                            return;
                        }
                        
                        // Utiliser directement le dataUrl comme URL pour l'aperçu
                        // Cela garantit que l'URL persistera après le rechargement ou le déploiement
                        const photoData = {
                            id: Date.now() + Math.random(),
                            url: dataUrl, // Utiliser directement le dataUrl comme URL
                            dataUrl: dataUrl, // Pour le PDF et comme sauvegarde
                            name: file.name,
                            size: compressedBlob.size
                        };
                        
                        console.log(`🔍 DEBUG - Photo créée:`, {
                            id: photoData.id,
                            name: photoData.name,
                            urlLength: photoData.url ? photoData.url.length : 0,
                            dataUrlLength: photoData.dataUrl ? photoData.dataUrl.length : 0,
                            urlStart: photoData.url ? photoData.url.substring(0, 30) + '...' : 'null',
                            dataUrlStart: photoData.dataUrl ? photoData.dataUrl.substring(0, 30) + '...' : 'null'
                        });
                        
                        // Vérification finale que le dataUrl est valide
                        if (!photoData.dataUrl || !photoData.dataUrl.startsWith('data:image/')) {
                            console.error(`❌ DataURL invalide pour ${file.name} après création de photoData`);
                            showToast(`Erreur lors du traitement de l'image ${file.name}`, 'error');
                            return;
                        }
                        
                        sectionPhotos[sectionIndex].push(photoData);
                        console.log(`✅ Photo ajoutée à la section ${sectionIndex}: ${photoData.name}`);
                        console.log(`✅ Nombre total de photos dans la section ${sectionIndex}: ${sectionPhotos[sectionIndex].length}`);
                        
                        // Vérifier que la photo a bien été ajoutée
                        const photoExists = sectionPhotos[sectionIndex].some(p => p.id === photoData.id);
                        console.log(`✅ Vérification: photo existe dans sectionPhotos[${sectionIndex}]: ${photoExists}`);
                        
                        // Sauvegarder immédiatement pour conserver les dataUrl
                        saveFormData();
                        
                        updatePhotoPreview(sectionIndex);
                        showToast(`Photo "${file.name}" ajoutée avec succès`, 'success');
                    };
                    
                    reader.onerror = function(error) {
                        console.error(`❌ Erreur lors de la lecture du fichier:`, error);
                        showToast('Erreur lors de la lecture de l\'image', 'error');
                    };
                    
                    console.log(`🔄 Démarrage de la lecture du fichier compressé en DataURL...`);
                    reader.readAsDataURL(compressedBlob); // Utiliser le blob compressé au lieu du fichier original
                }).catch(error => {
                    console.error(`❌ Erreur lors de la compression de l'image:`, error);
                    
                    // Fallback: essayer de lire le fichier original sans compression
                    console.log(`🔄 Tentative de lecture du fichier original sans compression...`);
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const dataUrl = e.target.result;
                        
                        // Vérifier que le dataUrl est valide
                        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
                            console.error(`❌ DataURL invalide pour ${file.name}`);
                            showToast(`Erreur lors du traitement de l'image ${file.name}`, 'error');
                            return;
                        }
                        
                        const photoData = {
                            id: Date.now() + Math.random(),
                            url: dataUrl, // Utiliser directement le dataUrl comme URL
                            dataUrl: dataUrl, // Pour le PDF et comme sauvegarde
                            name: file.name,
                            size: file.size
                        };
                        
                        sectionPhotos[sectionIndex].push(photoData);
                        saveFormData();
                        updatePhotoPreview(sectionIndex);
                        showToast(`Photo "${file.name}" ajoutée avec succès (sans compression)`, 'success');
                    };
                    
                    reader.onerror = function(error) {
                        console.error(`❌ Erreur lors de la lecture du fichier original:`, error);
                        showToast('Erreur lors de la lecture de l\'image', 'error');
                    };
                    
                    reader.readAsDataURL(file);
                });
                
            } catch (error) {
                console.error('❌ Error processing image:', error);
                showToast('Erreur lors du traitement de l\'image', 'error');
            }
        } else {
            console.warn(`⚠️ File ${file.name} is not an image`);
            showToast(`Le fichier "${file.name}" n'est pas une image`, 'warning');
        }
    }
    
    // Clear input
    event.target.value = '';
}

// Compress and correct image orientation
function compressImage(file) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`🔄 Compression de l'image ${file.name} (taille originale: ${(file.size / 1024).toFixed(2)} KB)...`);
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Définir un seul gestionnaire onload pour éviter les duplications
            img.onload = function() {
                try {
                    URL.revokeObjectURL(img.src); // Nettoyer l'URL de l'objet immédiatement
                    console.log(`✅ Image chargée avec succès: ${img.width}x${img.height}`);
                    
                    // Check if EXIF library is available
                    if (typeof EXIF !== 'undefined') {
                        // Get EXIF orientation data
                        EXIF.getData(file, function() {
                            try {
                                const orientation = EXIF.getTag(this, 'Orientation') || 1;
                                console.log(`📏 Orientation EXIF détectée: ${orientation}`);
                                processImageWithOrientation(img, canvas, ctx, orientation, file, resolve, reject);
                            } catch (exifError) {
                                console.error(`❌ Erreur lors du traitement EXIF:`, exifError);
                                // Fallback without EXIF processing
                                processImageWithOrientation(img, canvas, ctx, 1, file, resolve, reject);
                            }
                        });
                    } else {
                        console.log(`ℹ️ Bibliothèque EXIF non disponible, traitement sans correction d'orientation`);
                        // Fallback without EXIF processing
                        processImageWithOrientation(img, canvas, ctx, 1, file, resolve, reject);
                    }
                } catch (error) {
                    console.error(`❌ Erreur dans le gestionnaire onload:`, error);
                    reject(error);
                }
            };
            
            img.onerror = function(error) {
                console.error(`❌ Erreur lors du chargement de l'image:`, error);
                URL.revokeObjectURL(img.src); // Nettoyer l'URL même en cas d'erreur
                reject(new Error(`Erreur lors du chargement de l'image: ${error}`));
            };
            
            // Définir un timeout pour éviter les blocages
            const timeout = setTimeout(() => {
                console.error(`⏱️ Timeout lors du chargement de l'image ${file.name}`);
                URL.revokeObjectURL(img.src);
                reject(new Error(`Timeout lors du chargement de l'image ${file.name}`));
            }, 10000); // 10 secondes de timeout
            
            // Modifier le gestionnaire onload pour annuler le timeout
            const originalOnload = img.onload;
            img.onload = function(e) {
                clearTimeout(timeout);
                originalOnload.call(this, e);
            };
            
            const objectURL = URL.createObjectURL(file);
            console.log(`🔗 URL de l'objet créée pour ${file.name}`);
            img.src = objectURL;
        } catch (error) {
            console.error(`❌ Erreur globale dans compressImage:`, error);
            reject(error);
        }
    });
}

function processImageWithOrientation(img, canvas, ctx, orientation, originalFile, resolve, reject) {
    try {
        // Preserve aspect ratio while limiting size
        let { width, height } = img;
        console.log(`📏 Dimensions originales: ${width}x${height}`);
        
        // Déterminer la taille maximale en fonction de la taille du fichier original
        // Plus le fichier est grand, plus on réduit la taille maximale
        const fileSizeKB = originalFile.size / 1024;
        const fileSizeMB = fileSizeKB / 1024;
        
        // Ajuster la taille maximale en fonction de la taille du fichier
        let maxSize;
        if (fileSizeMB > 10) { // Plus de 10MB
            maxSize = 500;
            console.log(`📏 Fichier extrêmement volumineux (${fileSizeMB.toFixed(2)} MB), réduction à ${maxSize}px max`);
        } else if (fileSizeMB > 5) { // Plus de 5MB
            maxSize = 600;
            console.log(`📏 Fichier très volumineux (${fileSizeMB.toFixed(2)} MB), réduction à ${maxSize}px max`);
        } else if (fileSizeMB > 2) { // Plus de 2MB
            maxSize = 700;
            console.log(`📏 Fichier volumineux (${fileSizeMB.toFixed(2)} MB), réduction à ${maxSize}px max`);
        } else if (fileSizeMB > 1) { // Plus de 1MB
            maxSize = 800;
            console.log(`📏 Fichier de taille moyenne (${fileSizeMB.toFixed(2)} MB), réduction à ${maxSize}px max`);
        } else {
            maxSize = 1000; // Pour les petits fichiers, on peut garder une meilleure résolution
            console.log(`📏 Fichier de petite taille (${fileSizeMB.toFixed(2)} MB), réduction à ${maxSize}px max`);
        }
        
        // Réduire davantage si l'image est très grande en dimensions
        const megapixels = (width * height) / 1000000;
        if (megapixels > 12) { // Images très haute résolution
            maxSize = Math.min(maxSize, 600);
            console.log(`📏 Image très haute résolution (${megapixels.toFixed(2)} MP), limitation supplémentaire à ${maxSize}px`);
        } else if (megapixels > 8) {
            maxSize = Math.min(maxSize, 700);
            console.log(`📏 Image haute résolution (${megapixels.toFixed(2)} MP), limitation supplémentaire à ${maxSize}px`);
        }
        
        // Calculate new dimensions preserving aspect ratio
        if (width > height && width > maxSize) {
            height = Math.floor((height * maxSize) / width);
            width = maxSize;
        } else if (height > maxSize) {
            width = Math.floor((width * maxSize) / height);
            height = maxSize;
        }
        
        console.log(`📏 Nouvelles dimensions après redimensionnement: ${width}x${height}`);
        
        // Set canvas dimensions based on orientation
        let canvasWidth = width;
        let canvasHeight = height;
        
        if (orientation >= 5 && orientation <= 8) {
            // Swap dimensions for rotated images
            canvasWidth = height;
            canvasHeight = width;
            console.log(`📏 Dimensions du canvas après rotation: ${canvasWidth}x${canvasHeight}`);
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Apply rotation transformation based on EXIF orientation
        ctx.save();
        switch (orientation) {
            case 2:
                // Flip horizontal
                ctx.scale(-1, 1);
                ctx.translate(-canvasWidth, 0);
                console.log(`🔄 Application du retournement horizontal`);
                break;
            case 3:
                // Rotate 180°
                ctx.rotate(Math.PI);
                ctx.translate(-canvasWidth, -canvasHeight);
                console.log(`🔄 Application de la rotation 180°`);
                break;
            case 4:
                // Flip vertical
                ctx.scale(1, -1);
                ctx.translate(0, -canvasHeight);
                console.log(`🔄 Application du retournement vertical`);
                break;
            case 5:
                // Rotate 90° CCW + flip horizontal
                ctx.rotate(-Math.PI / 2);
                ctx.scale(-1, 1);
                ctx.translate(-canvasHeight, -canvasWidth);
                console.log(`🔄 Application de la rotation 90° CCW + retournement horizontal`);
                break;
            case 6:
                // Rotate 90° CW
                ctx.rotate(Math.PI / 2);
                ctx.translate(0, -canvasHeight);
                console.log(`🔄 Application de la rotation 90° CW`);
                break;
            case 7:
                // Rotate 90° CW + flip horizontal
                ctx.rotate(Math.PI / 2);
                ctx.scale(-1, 1);
                ctx.translate(-canvasWidth, -canvasHeight);
                console.log(`🔄 Application de la rotation 90° CW + retournement horizontal`);
                break;
            case 8:
                // Rotate 90° CCW
                ctx.rotate(-Math.PI / 2);
                ctx.translate(-canvasWidth, 0);
                console.log(`🔄 Application de la rotation 90° CCW`);
                break;
            default:
                // No rotation needed
                console.log(`ℹ️ Aucune rotation nécessaire`);
                break;
        }
        
        // Améliorer la qualité du rendu
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image with correct orientation and preserved ratio
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
        
        // Déterminer la qualité de compression en fonction de la taille du fichier original
        // Compression plus agressive pour les fichiers plus volumineux
        let compressionQuality;
        
        if (fileSizeMB > 10) { // Plus de 10MB
            compressionQuality = 0.4; // 40% de qualité
            console.log(`🔧 Fichier extrêmement volumineux, compression très agressive (qualité: ${compressionQuality})`);
        } else if (fileSizeMB > 5) { // Plus de 5MB
            compressionQuality = 0.5; // 50% de qualité
            console.log(`🔧 Fichier très volumineux, compression agressive (qualité: ${compressionQuality})`);
        } else if (fileSizeMB > 2) { // Plus de 2MB
            compressionQuality = 0.6; // 60% de qualité
            console.log(`🔧 Fichier volumineux, compression moyenne (qualité: ${compressionQuality})`);
        } else if (fileSizeMB > 1) { // Plus de 1MB
            compressionQuality = 0.7; // 70% de qualité
            console.log(`🔧 Fichier de taille moyenne, compression standard (qualité: ${compressionQuality})`);
        } else {
            compressionQuality = 0.8; // 80% de qualité pour les petits fichiers
            console.log(`🔧 Fichier de petite taille, compression légère (qualité: ${compressionQuality})`);
        }
        
        // Tentative de compression avec la qualité déterminée
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const compressionRatio = blob.size / originalFile.size;
                    console.log(`✅ Image compressée avec succès: ${(blob.size / 1024).toFixed(2)} KB (réduction de ${((1 - compressionRatio) * 100).toFixed(2)}%)`);
                    
                    // Si la compression n'est pas suffisante (réduction < 30%) et que le fichier est encore gros,
                    // essayer une compression plus agressive
                    if (compressionRatio > 0.7 && blob.size > 500 * 1024) {
                        console.log(`🔄 Compression insuffisante, tentative avec une qualité plus basse...`);
                        const lowerQuality = Math.max(0.3, compressionQuality - 0.2);
                        console.log(`🔧 Nouvelle qualité: ${lowerQuality}`);
                        
                        canvas.toBlob(
                            (secondBlob) => {
                                if (secondBlob) {
                                    console.log(`✅ Seconde compression: ${(secondBlob.size / 1024).toFixed(2)} KB (réduction de ${((1 - secondBlob.size / originalFile.size) * 100).toFixed(2)}%)`);
                                    resolve(secondBlob);
                                } else {
                                    console.log(`⚠️ Échec de la seconde compression, utilisation du premier résultat`);
                                    resolve(blob);
                                }
                            },
                            'image/jpeg',
                            lowerQuality
                        );
                    } else {
                        resolve(blob);
                    }
                } else {
                    console.error(`❌ Échec de la compression: blob null`);
                    reject(new Error('Échec de la compression: blob null'));
                }
            },
            'image/jpeg',
            compressionQuality
        );
    } catch (error) {
        console.error(`❌ Erreur lors du traitement de l'image:`, error);
        reject(error);
    }
}

// Update photo preview for a section
function updatePhotoPreview(sectionIndex) {
    console.log(`🔍 updatePhotoPreview pour la section ${sectionIndex}`);
    
    const previewContainer = document.getElementById(`photo-preview-${sectionIndex}`);
    if (!previewContainer) {
        console.warn(`⚠️ Container d'aperçu non trouvé pour la section ${sectionIndex}`);
        return;
    }
    
    const photos = sectionPhotos[sectionIndex] || [];
    console.log(`📸 Section ${sectionIndex}: ${photos.length} photos à afficher`);
    
    // Vérifier si les photos ont des URLs valides et des dataUrl
    let photosWithMissingUrl = 0;
    let photosWithMissingDataUrl = 0;
    let photosFixed = 0;
    
    photos.forEach((photo, idx) => {
        if (!photo.url) photosWithMissingUrl++;
        if (!photo.dataUrl || !photo.dataUrl.startsWith('data:image/')) photosWithMissingDataUrl++;
        console.log(`📸 Photo ${idx+1}: ${photo.name}, URL: ${photo.url ? 'présente' : 'MANQUANTE'}, dataUrl: ${photo.dataUrl ? (photo.dataUrl.startsWith('data:image/') ? 'valide' : 'invalide') : 'MANQUANTE'}`);
    });
    
    console.log(`📊 Statistiques: ${photosWithMissingUrl} photos sans URL, ${photosWithMissingDataUrl} photos sans dataUrl valide`);
    
    previewContainer.innerHTML = '';
    console.log(`🧹 Nettoyage des aperçus existants pour la section ${sectionIndex}`);
    
    // Filtrer les photos qui ont au moins un dataUrl valide (nécessaire pour le PDF)
    const validPhotos = photos.filter(photo => photo.dataUrl && photo.dataUrl.startsWith('data:image/'));
    
    if (validPhotos.length < photos.length) {
        console.warn(`⚠️ ${photos.length - validPhotos.length} photos ont été ignorées car elles n'ont pas de dataUrl valide`);
        // Mettre à jour sectionPhotos pour ne garder que les photos valides
        sectionPhotos[sectionIndex] = validPhotos;
        // Sauvegarder les modifications
        saveFormData();
        showToast(`${photos.length - validPhotos.length} photo(s) invalide(s) ont été supprimées`, 'warning');
    }
    
    validPhotos.forEach((photo, idx) => {
        console.log(`🖼️ Création de l'aperçu pour la photo ${idx+1}/${validPhotos.length} (${photo.name})`);
        
        // Vérifier si l'URL de la photo existe
        if (!photo.url) {
            console.log(`🔄 URL manquante pour la photo ${idx} (${photo.name}), utilisation du dataUrl`);
            
            // Si dataUrl existe mais pas url, utiliser directement le dataUrl
            if (photo.dataUrl) {
                photo.url = photo.dataUrl;
                console.log(`✅ URL définie à partir du dataUrl pour ${photo.name}`);
                photosFixed++;
            }
        }
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        const img = document.createElement('img');
        // Utiliser dataUrl directement si l'URL n'a pas pu être recréée
        const imgSrc = photo.url || photo.dataUrl;
        console.log(`🖼️ Image source pour ${photo.name}: ${imgSrc ? (imgSrc.substring(0, 30) + '...') : 'MANQUANTE'}`);
        console.log(`🖼️ Type de source: ${imgSrc ? (imgSrc.startsWith('data:image/') ? 'dataUrl' : 'URL') : 'AUCUNE'}`);
        
        img.src = imgSrc;
        img.alt = photo.name;
        
        // Ajouter un gestionnaire d'événements pour détecter les erreurs de chargement d'image
        img.onerror = function() {
            console.error(`❌ Erreur de chargement de l'image ${photo.name}`);
            
            // Essayer d'utiliser le dataUrl directement si l'URL échoue
            if (img.src !== photo.dataUrl && photo.dataUrl) {
                console.log(`🔄 Tentative d'utilisation directe du dataUrl pour ${photo.name}`);
                img.src = photo.dataUrl;
            } else {
                // Si tout échoue, afficher une icône d'erreur
                img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZjAwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PGxpbmUgeDE9IjE1IiB5MT0iOSIgeDI9IjkiIHkyPSIxNSI+PC9saW5lPjxsaW5lIHgxPSI5IiB5MT0iOSIgeDI9IjE1IiB5Mj0iMTUiPjwvbGluZT48L3N2Zz4='; // Icône d'erreur
                img.alt = 'Erreur de chargement';
            }
        };
        
        img.onload = function() {
            console.log(`✅ Image ${photo.name} chargée avec succès`);
        };
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'photo-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`🗑️ Suppression de la photo ${photo.name} (id: ${photo.id}) de la section ${sectionIndex}`);
            removePhoto(sectionIndex, photo.id);
        });
        
        photoItem.appendChild(img);
        photoItem.appendChild(removeBtn);
        previewContainer.appendChild(photoItem);
        
        console.log(`✅ Aperçu ajouté pour la photo ${idx+1} (${photo.name})`);
    });
    
    // Update photo count
    const photoSection = previewContainer.closest('.photo-section');
    if (photoSection) {
        let countElement = photoSection.querySelector('.photo-count');
        if (!countElement) {
            countElement = document.createElement('div');
            countElement.className = 'photo-count';
            photoSection.appendChild(countElement);
        }
        countElement.textContent = `${validPhotos.length}/6 photos`;
        console.log(`📊 Compteur de photos mis à jour: ${validPhotos.length}/6`);
    } else {
        console.warn(`⚠️ Section photo non trouvée pour le container d'aperçu ${sectionIndex}`);
    }
    
    if (photosFixed > 0) {
        console.log(`🔧 ${photosFixed} photos ont été réparées`);
        // Sauvegarder les modifications après réparation
        saveFormData();
    }
    
    console.log(`✅ Mise à jour de l'aperçu terminée pour la section ${sectionIndex}`);
}

// Remove photo
function removePhoto(sectionIndex, photoId) {
    console.log(`🗑️ removePhoto: Suppression de la photo id=${photoId} de la section ${sectionIndex}`);
    
    if (!sectionPhotos[sectionIndex]) {
        console.error(`❌ Erreur: sectionPhotos[${sectionIndex}] n'existe pas`);
        return;
    }
    
    const initialCount = sectionPhotos[sectionIndex].length;
    console.log(`📊 Nombre de photos avant suppression: ${initialCount}`);
    
    // Trouver la photo à supprimer pour le logging
    const photoToRemove = sectionPhotos[sectionIndex].find(photo => photo.id === photoId);
    if (photoToRemove) {
        console.log(`🔍 Photo trouvée pour suppression: ${photoToRemove.name}`);
    } else {
        console.warn(`⚠️ Photo avec id=${photoId} non trouvée dans la section ${sectionIndex}`);
    }
    
    sectionPhotos[sectionIndex] = sectionPhotos[sectionIndex].filter(photo => {
        if (photo.id === photoId) {
            console.log(`🔄 Suppression de la photo ${photo.name}`);
            return false;
        }
        return true;
    });
    
    const finalCount = sectionPhotos[sectionIndex].length;
    console.log(`📊 Nombre de photos après suppression: ${finalCount}`);
    
    if (initialCount === finalCount) {
        console.warn(`⚠️ Aucune photo n'a été supprimée. La photo avec id=${photoId} n'a pas été trouvée.`);
    } else {
        console.log(`✅ Photo supprimée avec succès (${initialCount} → ${finalCount})`);
    }
    
    // Mettre à jour l'aperçu
    console.log(`🔄 Mise à jour de l'aperçu après suppression`);
    updatePhotoPreview(sectionIndex);
}

// Handle form input changes
function handleFormInput(event) {
    const field = event.target;
    if (!field.name) return;
    
    const value = field.type === 'checkbox' ? field.checked : field.value;
    formData[field.name] = value;
    
    console.log('Form input changed:', field.name, '=', value);
    
    // Clear any existing error state
    field.classList.remove('error');
    const errorMsg = field.parentNode.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
    
    // Validate and update UI after a short delay
    setTimeout(() => {
        validateCurrentSection();
        updateSectionStatus();
        updateProgress();
    }, 100);
}

// Section navigation
function goToSection(index) {
    if (index < 0 || index >= sections.length) {
        console.log('Invalid section index:', index);
        return;
    }
    
    console.log('Going to section:', index, sectionIds[index]);
    
    // Validate current section before leaving
    validateCurrentSection();
    
    // Hide all sections and remove active class from all nav buttons
    sections.forEach(section => section.classList.remove('active'));
    navButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show new section and activate corresponding nav button
    currentSection = index;
    sections[currentSection].classList.add('active');
    navButtons[currentSection].classList.add('active');
    
    updateUI();
    
    // Scroll to top smoothly
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    console.log('Section changed to:', currentSection);
}

function nextSection() {
    console.log('Next section requested from:', currentSection);
    if (currentSection < sections.length - 1) {
        // Validate current section but allow navigation regardless
        const isValid = validateCurrentSection();
        if (!isValid) {
            showToast('Certains champs obligatoires ne sont pas remplis. Vous pouvez continuer mais pensez à les compléter.', 'warning');
        }
        goToSection(currentSection + 1);
    } else {
        console.log('Already at last section');
    }
}

// Form validation
function validateCurrentSection() {
    const requiredFields = requiredFieldsBySectionIndex[currentSection] || [];
    let isValid = true;
    
    // Clear previous error states in current section
    const currentSectionEl = sections[currentSection];
    currentSectionEl.querySelectorAll('.error').forEach(el => {
        el.classList.remove('error');
    });
    currentSectionEl.querySelectorAll('.error-message').forEach(el => {
        el.remove();
    });
    
    // Check required fields
    requiredFields.forEach(fieldName => {
        const field = document.querySelector(`[name="${fieldName}"]`);
        if (!field) {
            console.log('Required field not found:', fieldName);
            return;
        }
        
        let fieldValue;
        if (field.type === 'checkbox') {
            fieldValue = field.checked;
        } else {
            fieldValue = formData[fieldName] || '';
            if (typeof fieldValue === 'string') {
                fieldValue = fieldValue.trim();
            }
        }
        
        if (!fieldValue) {
            field.classList.add('error');
            isValid = false;
            
            // Add error message
            const errorMsg = document.createElement('span');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Ce champ est obligatoire';
            if (field.parentNode) {
                field.parentNode.appendChild(errorMsg);
            }
        }
    });
    
    // Update section completion status
    if (isValid) {
        completedSections.add(currentSection);
        console.log('Section completed:', currentSection);
    } else {
        completedSections.delete(currentSection);
        console.log('Section incomplete:', currentSection);
    }
    
    return isValid;
}

function validateAllSections() {
    let allValid = true;
    
    for (let i = 0; i < sections.length; i++) {
        const requiredFields = requiredFieldsBySectionIndex[i] || [];
        let sectionValid = true;
        
        requiredFields.forEach(fieldName => {
            const fieldValue = formData[fieldName];
            if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
                sectionValid = false;
                allValid = false;
            }
        });
        
        if (sectionValid) {
            completedSections.add(i);
        } else {
            completedSections.delete(i);
        }
    }
    
    return allValid;
}

// UI updates
function updateUI() {
    // Show next button except on last section
    if (nextBtn) {
        nextBtn.style.display = currentSection === sections.length - 1 ? 'none' : 'flex';
        nextBtn.textContent = 'Suivant';
    }
    
    // Show PDF generation and reset buttons on last section
    if (generatePDFBtn && newInspectionBtn) {
        if (currentSection === sections.length - 1) {
            generatePDFBtn.style.display = 'block';
            newInspectionBtn.style.display = 'block';
        } else {
            generatePDFBtn.style.display = 'none';
            newInspectionBtn.style.display = 'none';
        }
    }
    
    updateProgress();
    updateSectionStatus();
    
    console.log('UI updated for section:', currentSection);
}

function updateProgress() {
    const totalSections = sections.length;
    const completedCount = completedSections.size;
    const progress = totalSections > 0 ? (completedCount / totalSections) * 100 : 0;
    
    console.log('Updating progress:', completedCount, '/', totalSections, '=', progress + '%');
    
    // Update progress bar
    if (progressBar) {
        progressBar.style.background = `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-secondary) ${progress}%)`;
    }
    
    // Update progress text
    if (progressText) {
        progressText.textContent = `${completedCount}/${totalSections} sections`;
    }
    
    console.log('Progress updated to:', completedCount, '/', totalSections);
}

function updateSectionStatus() {
    navButtons.forEach((btn, index) => {
        btn.classList.remove('completed');
        if (completedSections.has(index)) {
            btn.classList.add('completed');
        }
    });
}

// Data persistence and auto-save
function startAutoSave() {
    // Auto-save every 10 seconds
    autoSaveTimer = setInterval(() => {
        saveFormData();
    }, 10000);
}

function saveFormData() {
    try {
        console.log(`🔄 Sauvegarde des données du formulaire...`);
        
        // Collect current form data
        const formElements = form.querySelectorAll('input, select, textarea');
        formElements.forEach(element => {
            if (element.name) {
                if (element.type === 'checkbox') {
                    formData[element.name] = element.checked;
                } else {
                    formData[element.name] = element.value;
                }
            }
        });
        
        // Vérifier les photos avant sauvegarde
        console.log(`📸 Vérification des photos avant sauvegarde:`);
        let totalPhotos = 0;
        Object.keys(sectionPhotos).forEach(sectionIndex => {
            if (Array.isArray(sectionPhotos[sectionIndex])) {
                const photos = sectionPhotos[sectionIndex];
                console.log(`📸 Section ${sectionIndex}: ${photos.length} photos`);
                
                // Vérifier que chaque photo a un dataUrl
                photos.forEach((photo, idx) => {
                    const hasDataUrl = !!photo.dataUrl;
                    console.log(`📸 Section ${sectionIndex}, Photo ${idx+1} (${photo.name}): dataUrl présent: ${hasDataUrl}`);
                    if (hasDataUrl) {
                        console.log(`📸 DataUrl longueur: ${photo.dataUrl.length} caractères`);
                    }
                    totalPhotos++;
                });
            } else {
                console.warn(`⚠️ sectionPhotos[${sectionIndex}] n'est pas un tableau`);
            }
        });
        console.log(`📸 Total des photos: ${totalPhotos}`);
        
        const dataToSave = {
            formData,
            completedSections: Array.from(completedSections),
            currentSection,
            sectionPhotos,
            lastSaved: new Date().toISOString()
        };
        
        // Vérifier la taille des données avant sauvegarde
        const jsonData = JSON.stringify(dataToSave);
        console.log(`💾 Taille des données à sauvegarder: ${jsonData.length} caractères`);
        
        // Vérifier si la taille n'est pas trop grande pour sessionStorage
        const maxSize = 5 * 1024 * 1024; // 5MB (limite approximative pour la plupart des navigateurs)
        if (jsonData.length > maxSize) {
            console.warn(`⚠️ Les données sont très volumineuses (${(jsonData.length/1024/1024).toFixed(2)}MB), risque de dépassement de limite de sessionStorage`);
        }
        
        sessionStorage.setItem('elevatorInspection', jsonData);
        console.log(`✅ Données sauvegardées dans sessionStorage avec succès`);
        
        // Show save indicator briefly
        showSaveStatus('saved');
        
    } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde dans sessionStorage:`, error);
        console.error(`❌ Détails de l'erreur:`, error.message);
        showToast('Erreur de sauvegarde des données', 'error');
    }
}

function loadFormData() {
    try {
        console.log(`🔄 Chargement des données du formulaire...`);
        const savedData = sessionStorage.getItem('elevatorInspection');
        
        if (savedData) {
            console.log(`📦 Données trouvées dans sessionStorage, taille: ${savedData.length} caractères`);
            
            const data = JSON.parse(savedData);
            formData = data.formData || {};
            completedSections = new Set(data.completedSections || []);
            currentSection = data.currentSection || 0;
            
            // Vérifier les photos avant de les charger
            const loadedPhotos = data.sectionPhotos || {};
            console.log(`📸 Vérification des photos chargées:`);
            let totalPhotos = 0;
            let validPhotos = 0;
            let invalidPhotos = 0;
            
            // Nettoyer et valider les photos chargées
            Object.keys(loadedPhotos).forEach(sectionIndex => {
                if (Array.isArray(loadedPhotos[sectionIndex])) {
                    // Filtrer pour ne garder que les photos avec un dataUrl valide
                    const allPhotos = loadedPhotos[sectionIndex];
                    console.log(`📸 Section ${sectionIndex}: ${allPhotos.length} photos trouvées`);
                    
                    const validSectionPhotos = allPhotos.filter(photo => {
                        const hasDataUrl = !!photo.dataUrl && photo.dataUrl.startsWith('data:image/');
                        if (!hasDataUrl) {
                            console.warn(`⚠️ Photo sans dataUrl valide: ${photo.name || 'Sans nom'}`);
                            invalidPhotos++;
                            return false;
                        }
                        
                        console.log(`📸 Photo valide: ${photo.name}, dataUrl longueur: ${photo.dataUrl.length} caractères`);
                        validPhotos++;
                        return true;
                    });
                    
                    if (validSectionPhotos.length < allPhotos.length) {
                        console.warn(`⚠️ Section ${sectionIndex}: ${allPhotos.length - validSectionPhotos.length} photos invalides ont été supprimées`);
                    }
                    
                    // Mettre à jour avec seulement les photos valides
                    loadedPhotos[sectionIndex] = validSectionPhotos;
                    totalPhotos += validSectionPhotos.length;
                } else {
                    console.warn(`⚠️ loadedPhotos[${sectionIndex}] n'est pas un tableau, initialisation...`);
                    loadedPhotos[sectionIndex] = [];
                }
            });
            
            console.log(`📸 Bilan des photos chargées: ${totalPhotos} valides, ${invalidPhotos} invalides`);
            sectionPhotos = loadedPhotos;
            
            // Si des photos ont été supprimées, sauvegarder immédiatement les modifications
            if (invalidPhotos > 0) {
                console.log(`🔄 Sauvegarde des données après nettoyage des photos invalides...`);
                setTimeout(() => {
                    saveFormData();
                }, 500);
            }
            
            console.log(`✅ Données chargées avec succès:`, {
                formFields: Object.keys(formData).length,
                completedSections: Array.from(completedSections),
                currentSection,
                photoSections: Object.keys(sectionPhotos).length,
                totalPhotos
            });
            
            // Restore form values and photos
            setTimeout(() => {
                console.log(`🔄 Restauration des valeurs du formulaire...`);
                Object.keys(formData).forEach(key => {
                    const field = document.querySelector(`[name="${key}"]`);
                    if (field) {
                        if (field.type === 'checkbox') {
                            field.checked = formData[key];
                        } else {
                            field.value = formData[key];
                        }
                    }
                });
                
                // Restore photo previews
                console.log(`🔄 Restauration des aperçus de photos...`);
                Object.keys(sectionPhotos).forEach(sectionIndex => {
                    console.log(`🔄 Mise à jour de l'aperçu pour la section ${sectionIndex}`);
                    updatePhotoPreview(parseInt(sectionIndex));
                });
                
                // Validate all sections to rebuild completion status
                validateAllSections();
                
                // Update UI to reflect loaded data
                goToSection(currentSection);
                
                // Show restoration message
                if (data.lastSaved) {
                    const lastSaved = new Date(data.lastSaved);
                    showToast(`Données restaurées (dernière sauvegarde: ${lastSaved.toLocaleString('fr-FR')})`, 'success');
                    console.log(`✅ Restauration terminée, dernière sauvegarde: ${lastSaved.toLocaleString('fr-FR')}`);
                }
                
            }, 200);
        } else {
            console.log(`ℹ️ Aucune donnée trouvée dans sessionStorage`);
        }
    } catch (error) {
        console.error(`❌ Erreur lors du chargement depuis sessionStorage:`, error);
        console.error(`❌ Détails de l'erreur:`, error.message);
        showToast('Erreur lors du chargement des données', 'error');
    }
}

function showSaveStatus(status) {
    // Create or update save status indicator
    let saveStatus = document.querySelector('.save-status');
    if (!saveStatus) {
        saveStatus = document.createElement('div');
        saveStatus.className = 'save-status';
        document.body.appendChild(saveStatus);
    }
    
    saveStatus.className = `save-status ${status} show`;
    saveStatus.textContent = status === 'saved' ? 'Sauvegardé' : 'Sauvegarde...';
    
    setTimeout(() => {
        saveStatus.classList.remove('show');
    }, 2000);
}

// Mobile-compatible PDF Generation
async function generatePDF() {
    console.log('🚀 Démarrage de la génération du PDF');
    
    // Vérifier l'état de sectionPhotos avant la génération
    console.log(`📸 État de sectionPhotos avant génération:`);
    console.log(`📸 Type de sectionPhotos: ${typeof sectionPhotos}`);
    console.log(`📸 sectionPhotos est un tableau? ${Array.isArray(sectionPhotos)}`);
    console.log(`📸 Clés de sectionPhotos: ${Object.keys(sectionPhotos).join(', ')}`);
    
    // Compter le nombre total de photos et vérifier leur validité
    let totalPhotos = 0;
    let photosWithDataUrl = 0;
    let photosWithUrl = 0;
    let invalidPhotos = 0;
    let photosFixed = false;
    
    // Nettoyer les photos avant la génération du PDF
    for (const sectionIndex in sectionPhotos) {
        if (Array.isArray(sectionPhotos[sectionIndex])) {
            console.log(`📸 Section ${sectionIndex}: ${sectionPhotos[sectionIndex].length} photos avant nettoyage`);
            
            // Filtrer pour ne garder que les photos avec un dataUrl valide
            const allPhotos = sectionPhotos[sectionIndex];
            const validSectionPhotos = allPhotos.filter(photo => {
                totalPhotos++;
                
                // Vérifier si dataUrl est présent et valide
                const hasValidDataUrl = !!photo.dataUrl && photo.dataUrl.startsWith('data:image/');
                if (hasValidDataUrl) {
                    photosWithDataUrl++;
                    console.log(`✅ Photo valide: ${photo.name}, dataUrl présent (${photo.dataUrl.length} caractères)`);
                    console.log(`✅ dataUrl commence par: ${photo.dataUrl.substring(0, 50)}...`);
                    
                    // Vérifier si l'URL est également présente
                    if (photo.url) {
                        console.log(`✅ URL également présente pour ${photo.name}: ${photo.url.substring(0, 50)}...`);
                        
                        // Si l'URL n'est pas un dataUrl, la remplacer par le dataUrl
                        if (!photo.url.startsWith('data:image/')) {
                            console.log(`🔄 Remplacement de l'URL par le dataUrl pour ${photo.name}`);
                            photo.url = photo.dataUrl;
                            photosFixed = true;
                        }
                    } else {
                        console.log(`⚠️ URL manquante pour ${photo.name}, utilisation du dataUrl`);
                        photo.url = photo.dataUrl;
                        photosFixed = true;
                    }
                    
                    return true;
                }
                
                if (photo.url) {
                    photosWithUrl++;
                    console.log(`⚠️ Photo avec URL mais sans dataUrl valide: ${photo.name}`);
                    
                    // On ne tente pas de récupérer le dataUrl ici car cela ne fonctionnera pas de manière asynchrone
                    // La récupération sera tentée plus tard de manière synchrone
                } else {
                    console.warn(`❌ Photo sans URL ni dataUrl: ${photo.name || 'Sans nom'}`);
                }
                
                invalidPhotos++;
                return false;
            });
            
            // Mettre à jour avec seulement les photos valides
            if (validSectionPhotos.length < allPhotos.length) {
                console.warn(`⚠️ Section ${sectionIndex}: ${allPhotos.length - validSectionPhotos.length} photos invalides ont été supprimées`);
                sectionPhotos[sectionIndex] = validSectionPhotos;
                photosFixed = true;
            }
            
            console.log(`📸 Section ${sectionIndex}: ${sectionPhotos[sectionIndex].length} photos après nettoyage`);
        }
    }
    
    // Si des photos ont été modifiées ou supprimées, sauvegarder les modifications
    if (photosFixed) {
        console.log(`🔄 Sauvegarde des données après nettoyage des photos...`);
        saveFormData();
    }
    
    console.log(`📊 Statistiques des photos:`);
    console.log(`📊 Nombre total de photos: ${totalPhotos}`);
    console.log(`📊 Photos avec dataUrl valide: ${photosWithDataUrl}/${totalPhotos}`);
    console.log(`📊 Photos avec url: ${photosWithUrl}/${totalPhotos}`);
    console.log(`📊 Photos invalides supprimées: ${invalidPhotos}`);
    
    // Collect all current form data
    const formElements = form.querySelectorAll('input, select, textarea');
    formElements.forEach(element => {
        if (element.name) {
            if (element.type === 'checkbox') {
                formData[element.name] = element.checked;
            } else {
                formData[element.name] = element.value;
            }
        }
    });
    
    // Check minimum required data
    const hasRequiredData = formData.adresse && formData.numero_appareil && formData.date_visite && formData.nom_technicien;
    
    if (!hasRequiredData) {
        console.error('❌ Données requises manquantes');
        showToast('Veuillez remplir au minimum l\'adresse, le numéro d\'appareil, la date et le nom du technicien.', 'error');
        return;
    }
    
    // Vérifier s'il y a des photos valides
    let validPhotoCount = 0;
    Object.keys(sectionPhotos).forEach(sectionIndex => {
        if (Array.isArray(sectionPhotos[sectionIndex])) {
            validPhotoCount += sectionPhotos[sectionIndex].length;
        }
    });
    
    if (totalPhotos > 0 && validPhotoCount === 0) {
        console.warn(`⚠️ Aucune photo valide n'a pu être récupérée pour le PDF`);
        showToast(`Attention: Aucune photo valide n'a pu être récupérée pour le PDF. Veuillez réajouter vos photos.`, 'warning');
    }
    
    // Show loading state
    generatePDFBtn.classList.add('loading');
    console.log('🔄 Affichage de l\'état de chargement');
    
    // Create loading overlay
    createLoadingOverlay();
    console.log('🔄 Création de l\'overlay de chargement');
    
    // Tentative de récupération synchrone des dataUrl manquants
    console.log('🔄 Tentative de récupération synchrone des dataUrl manquants...');
    let dataUrlRecovered = 0;
    
    // Fonction pour tenter de récupérer un dataUrl à partir d'une URL
    const tryRecoverDataUrl = async (photo) => {
        if (!photo.dataUrl && photo.url) {
            console.log(`🔄 Tentative de récupération du dataUrl pour ${photo.name || 'Sans nom'} à partir de l'URL`);
            
            // Fonction pour détecter le format d'image à partir de l'URL ou du contenu
            const detectImageFormat = (url, fallback = 'image/jpeg') => {
                if (!url) return fallback;
                
                // Détection par extension de fichier
                if (url.match(/\.png(\?|#|$)/i)) return 'image/png';
                if (url.match(/\.jpe?g(\?|#|$)/i)) return 'image/jpeg';
                if (url.match(/\.webp(\?|#|$)/i)) return 'image/webp';
                if (url.match(/\.gif(\?|#|$)/i)) return 'image/gif';
                
                // Si c'est un dataURL, extraire le type
                if (url.startsWith('data:image/')) {
                    const match = url.match(/^data:(image\/[^;]+);/);
                    if (match) return match[1];
                }
                
                return fallback;
            };
            
            // Fonction pour déterminer la qualité de compression optimale
            const getOptimalQuality = (width, height) => {
                const megapixels = (width * height) / 1000000;
                
                // Ajuster la qualité en fonction de la taille de l'image
                if (megapixels > 8) return 0.6;      // Très grande image
                if (megapixels > 4) return 0.7;      // Grande image
                if (megapixels > 2) return 0.8;      // Image moyenne
                return 0.85;                         // Petite image
            };
            
            // Nombre maximum de tentatives
            const maxRetries = 2;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Créer une image et la dessiner sur un canvas pour récupérer le dataUrl
                    const img = new Image();
                    img.crossOrigin = "Anonymous"; // Nécessaire pour les URL externes
                    
                    // Utiliser une promesse avec timeout pour éviter de bloquer
                    const dataUrlPromise = new Promise((resolve) => {
                        img.onload = function() {
                            try {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                
                                // Déterminer le format et la qualité optimale
                                const format = detectImageFormat(photo.url);
                                const quality = getOptimalQuality(img.width, img.height);
                                
                                console.log(`📊 Image ${photo.name || 'Sans nom'}: ${img.width}x${img.height} pixels, format: ${format}, qualité: ${quality}`);
                                
                                // Utiliser le format d'origine avec la qualité optimale
                                const newDataUrl = canvas.toDataURL(format, quality);
                                
                                // Libérer les ressources canvas
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                
                                resolve(newDataUrl);
                            } catch (canvasError) {
                                console.error(`❌ Erreur lors de la création du canvas (tentative ${attempt + 1}/${maxRetries}):`, canvasError);
                                resolve(null);
                            }
                        };
                        
                        img.onerror = (e) => {
                            console.error(`❌ Erreur de chargement de l'image (tentative ${attempt + 1}/${maxRetries}):`, e);
                            resolve(null);
                        };
                        
                        // Timeout de 5 secondes (augmenté pour les connexions lentes)
                        setTimeout(() => {
                            console.warn(`⏱️ Timeout dépassé pour le chargement de l'image (tentative ${attempt + 1}/${maxRetries})`);
                            resolve(null);
                        }, 5000);
                    });
                    
                    // Charger l'image
                    img.src = photo.url;
                    
                    // Attendre la résolution de la promesse
                    const newDataUrl = await dataUrlPromise;
                    
                    if (newDataUrl && newDataUrl.startsWith('data:image/')) {
                        photo.dataUrl = newDataUrl;
                        console.log(`✅ DataUrl récupéré pour ${photo.name || 'Sans nom'} (tentative ${attempt + 1}/${maxRetries})`);
                        dataUrlRecovered++;
                        return true;
                    } else if (attempt < maxRetries - 1) {
                        console.warn(`⚠️ Échec de récupération du dataUrl (tentative ${attempt + 1}/${maxRetries}), nouvelle tentative...`);
                        // Attendre un peu avant la prochaine tentative
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`❌ Erreur lors de la récupération du dataUrl (tentative ${attempt + 1}/${maxRetries}):`, error);
                    if (attempt < maxRetries - 1) {
                        // Attendre un peu avant la prochaine tentative
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            console.error(`❌ Échec de récupération du dataUrl après ${maxRetries} tentatives pour ${photo.name || 'Sans nom'}`);
        }
        return false;
    };
    
    // Tenter de récupérer les dataUrl pour toutes les photos
    const recoveryPromises = [];
    for (const sectionIndex in sectionPhotos) {
        if (Array.isArray(sectionPhotos[sectionIndex])) {
            for (const photo of sectionPhotos[sectionIndex]) {
                recoveryPromises.push(tryRecoverDataUrl(photo));
            }
        }
    }
    
    // Attendre que toutes les tentatives de récupération soient terminées
    await Promise.all(recoveryPromises);
    
    console.log(`📊 Tentative de récupération de dataUrl: ${dataUrlRecovered} photos récupérées`);
    
    // Si des photos ont été récupérées, sauvegarder les modifications
    if (dataUrlRecovered > 0) {
        console.log(`🔄 Sauvegarde des données après récupération des dataUrl...`);
        saveFormData();
    }
    
    setTimeout(async () => {
        console.log('🔄 Début de la génération du PDF après délai');
        try {
            const { jsPDF } = window.jspdf;
            console.log('🔄 Création du document PDF');
            const doc = new jsPDF();
            
            console.log('🔄 Ajout du contenu au PDF');
            await addContentToPDF(doc);
            
            // Mobile-compatible PDF download
            const filename = `Etat_lieux_ascenseur_${new Date().toISOString().slice(0,10)}.pdf`;
            console.log(`📄 Nom du fichier PDF: ${filename}`);
            
            // SOLUTION MOBILE : Utiliser le blob pour téléchargement mobile
            console.log('🔄 Génération du blob PDF');
            const pdfOutput = doc.output('blob');
            
            if (navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile/i)) {
                console.log('📱 Détection d\'un appareil mobile, utilisation du mode de téléchargement mobile');
                // Pour mobile : créer un lien de téléchargement
                const url = URL.createObjectURL(pdfOutput);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('✅ PDF téléchargé sur mobile');
            } else {
                console.log('🖥️ Détection d\'un appareil desktop, ouverture et téléchargement');
                // Pour desktop : ouverture + téléchargement
                const url = URL.createObjectURL(pdfOutput);
                window.open(url, '_blank');
                doc.save(filename);
                console.log('✅ PDF ouvert et téléchargé sur desktop');
            }
            
            console.log('🎉 Génération du PDF terminée avec succès');
            showToast('PDF généré et téléchargé avec succès !', 'success');
            
        } catch (error) {
            console.error('❌ Erreur lors de la génération du PDF:', error);
            console.error('❌ Stack trace:', error.stack);
            showToast('Erreur lors de la génération du PDF', 'error');
        } finally {
            generatePDFBtn.classList.remove('loading');
            removeLoadingOverlay();
            console.log('🧹 Nettoyage de l\'interface après génération');
        }
    }, 1000);
}

async function addContentToPDF(doc) {
    // PDF Configuration
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;
    let currentY = margin;
    
    // Helper functions
    function addText(text, x, y, maxWidth, options = {}) {
        const fontSize = options.fontSize || 10;
        const fontStyle = options.fontStyle || 'normal';
        
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        
        // Convertir explicitement en chaîne et gérer les valeurs null/undefined/false
        if (text === null || text === undefined) {
            text = '';
        } else if (typeof text === 'boolean') {
            text = text ? 'Oui' : 'Non';
        } else {
            text = String(text);
        }
        
        // Vérifier si le texte est vide après conversion
        if (text.trim() === '') {
            return y; // Ne pas ajouter de hauteur supplémentaire si le texte est vide
        }
        
        try {
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line, index) => {
                if (y + (index * lineHeight) < pageHeight - margin) {
                    doc.text(line, x, y + (index * lineHeight));
                }
            });
            
            return y + (lines.length * lineHeight);
        } catch (error) {
            console.error(`❌ Erreur lors de l'ajout du texte au PDF:`, error);
            console.error(`❌ Texte problématique:`, text);
            // Ajouter un texte d'erreur à la place
            doc.setTextColor(255, 0, 0); // Rouge pour l'erreur
            doc.text('[Erreur de texte]', x, y);
            doc.setTextColor(0, 0, 0); // Remettre la couleur par défaut
            return y + lineHeight;
        }
    }
    
    function checkPageBreak(nextContentHeight = 30) {
        if (currentY + nextContentHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            return true;
        }
        return false;
    }
    
    // Fonction pour afficher les photos en grille dans le PDF
    async function addPhotosGrid(photos, startY) {
        let currentY = startY;
        const validPhotos = photos.filter(photo => photo.dataUrl && photo.dataUrl.startsWith('data:image/'));
        
        if (validPhotos.length === 0) {
            return currentY;
        }
        
        console.log(`📊 Affichage de ${validPhotos.length} photos en grille`);
        
        // Paramètres de la grille
        const maxWidth = pageWidth - 2 * margin - 20;
        const photoMaxWidth = maxWidth / 2 - 10; // 2 photos par ligne avec 10px d'espacement
        const photoMaxHeight = 100;
        const horizontalSpacing = 20;
        
        // Traiter les photos par paires
        for (let i = 0; i < validPhotos.length; i += 2) {
            const leftPhoto = validPhotos[i];
            const rightPhoto = i + 1 < validPhotos.length ? validPhotos[i + 1] : null;
            
            let rowHeight = 0;
            let leftPhotoHeight = 0;
            let rightPhotoHeight = 0;
            
            // Traiter la photo de gauche
            try {
                // Charger l'image de gauche
                const leftImg = await new Promise((resolve, reject) => {
                    const img = new Image();
                    
                    img.onload = () => resolve(img);
                    img.onerror = (e) => reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                    
                    // Timeout pour éviter de bloquer indéfiniment
                    const timeoutId = setTimeout(() => {
                        reject(new Error('Timeout de chargement d\'image dépassé'));
                    }, 5000);
                    
                    // Nettoyer le timeout si l'image est chargée ou en erreur
                    img.onload = () => {
                        clearTimeout(timeoutId);
                        resolve(img);
                    };
                    
                    img.onerror = (e) => {
                        clearTimeout(timeoutId);
                        reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                    };
                    
                    img.src = leftPhoto.dataUrl;
                });
                
                // Calculer les dimensions mises à l'échelle
                let leftWidth = leftImg.width;
                let leftHeight = leftImg.height;
                
                // Mise à l'échelle
                const leftWidthRatio = photoMaxWidth / leftWidth;
                const leftHeightRatio = photoMaxHeight / leftHeight;
                const leftScale = Math.min(leftWidthRatio, leftHeightRatio, 1);
                
                leftWidth = leftWidth * leftScale;
                leftHeight = leftHeight * leftScale;
                leftPhotoHeight = leftHeight;
                
                // Vérifier l'espace disponible
                checkPageBreak(leftHeight + 30); // 30px pour le nom et l'espacement
                
                // Déterminer le format d'image
                let leftFormat = 'JPEG'; // Format par défaut
                
                if (leftPhoto.dataUrl.includes('data:image/png')) {
                    leftFormat = 'PNG';
                } else if (leftPhoto.dataUrl.includes('data:image/webp')) {
                    leftFormat = 'WEBP';
                } else if (leftPhoto.dataUrl.includes('data:image/jpeg') || leftPhoto.dataUrl.includes('data:image/jpg')) {
                    leftFormat = 'JPEG';
                } else if (leftPhoto.dataUrl.includes('data:image/gif')) {
                    leftFormat = 'GIF';
                }
                
                // Ajouter l'image
                try {
                    doc.addImage(leftPhoto.dataUrl, leftFormat, margin + 10, currentY, leftWidth, leftHeight);
                    console.log(`✅ Photo de gauche ajoutée: ${leftPhoto.name}`);
                    
                    // Ajouter le nom de la photo sous l'image
                    const leftNameY = currentY + leftHeight + 3;
                    addText(`${leftPhoto.name}`, margin + 10, leftNameY, leftWidth, { fontSize: 8 });
                } catch (error) {
                    console.error(`❌ Erreur lors de l'ajout de la photo de gauche:`, error);
                    // Essayer les formats de secours
                    const fallbackFormats = ['JPEG', 'PNG', 'WEBP'];
                    let success = false;
                    
                    for (const format of fallbackFormats) {
                        if (format !== leftFormat) {
                            try {
                                doc.addImage(leftPhoto.dataUrl, format, margin + 10, currentY, leftWidth, leftHeight);
                                console.log(`✅ Photo de gauche ajoutée avec format de secours ${format}`);
                                success = true;
                                
                                // Ajouter le nom de la photo sous l'image
                                const leftNameY = currentY + leftHeight + 3;
                                addText(`${leftPhoto.name}`, margin + 10, leftNameY, leftWidth, { fontSize: 8 });
                                break;
                            } catch (fallbackError) {
                                console.error(`❌ Échec du format de secours ${format}:`, fallbackError);
                            }
                        }
                    }
                    
                    if (!success) {
                        // Ajouter un message d'erreur à la place de l'image
                        doc.setTextColor(255, 0, 0);
                        addText(`[Erreur: ${leftPhoto.name}]`, margin + 10, currentY + 20, leftWidth, { fontSize: 9 });
                        doc.setTextColor(0, 0, 0);
                    }
                }
                
                rowHeight = Math.max(rowHeight, leftHeight + 15);
            } catch (error) {
                console.error(`❌ Erreur lors du traitement de la photo de gauche:`, error);
                doc.setTextColor(255, 0, 0);
                addText(`[Erreur: ${leftPhoto.name}]`, margin + 10, currentY + 20, photoMaxWidth, { fontSize: 9 });
                doc.setTextColor(0, 0, 0);
                rowHeight = Math.max(rowHeight, 35);
            }
            
            // Traiter la photo de droite si elle existe
            if (rightPhoto) {
                try {
                    // Charger l'image de droite
                    const rightImg = await new Promise((resolve, reject) => {
                        const img = new Image();
                        
                        img.onload = () => resolve(img);
                        img.onerror = (e) => reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                        
                        // Timeout pour éviter de bloquer indéfiniment
                        const timeoutId = setTimeout(() => {
                            reject(new Error('Timeout de chargement d\'image dépassé'));
                        }, 5000);
                        
                        // Nettoyer le timeout si l'image est chargée ou en erreur
                        img.onload = () => {
                            clearTimeout(timeoutId);
                            resolve(img);
                        };
                        
                        img.onerror = (e) => {
                            clearTimeout(timeoutId);
                            reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                        };
                        
                        img.src = rightPhoto.dataUrl;
                    });
                    
                    // Calculer les dimensions mises à l'échelle
                    let rightWidth = rightImg.width;
                    let rightHeight = rightImg.height;
                    
                    // Mise à l'échelle
                    const rightWidthRatio = photoMaxWidth / rightWidth;
                    const rightHeightRatio = photoMaxHeight / rightHeight;
                    const rightScale = Math.min(rightWidthRatio, rightHeightRatio, 1);
                    
                    rightWidth = rightWidth * rightScale;
                    rightHeight = rightHeight * rightScale;
                    rightPhotoHeight = rightHeight;
                    
                    // Déterminer le format d'image
                    let rightFormat = 'JPEG'; // Format par défaut
                    
                    if (rightPhoto.dataUrl.includes('data:image/png')) {
                        rightFormat = 'PNG';
                    } else if (rightPhoto.dataUrl.includes('data:image/webp')) {
                        rightFormat = 'WEBP';
                    } else if (rightPhoto.dataUrl.includes('data:image/jpeg') || rightPhoto.dataUrl.includes('data:image/jpg')) {
                        rightFormat = 'JPEG';
                    } else if (rightPhoto.dataUrl.includes('data:image/gif')) {
                        rightFormat = 'GIF';
                    }
                    
                    // Position X pour la photo de droite
                    const rightX = margin + 10 + photoMaxWidth + horizontalSpacing;
                    
                    // Ajouter l'image
                    try {
                        doc.addImage(rightPhoto.dataUrl, rightFormat, rightX, currentY, rightWidth, rightHeight);
                        console.log(`✅ Photo de droite ajoutée: ${rightPhoto.name}`);
                        
                        // Ajouter le nom de la photo sous l'image
                        const rightNameY = currentY + rightHeight + 3;
                        addText(`${rightPhoto.name}`, rightX, rightNameY, rightWidth, { fontSize: 8 });
                    } catch (error) {
                        console.error(`❌ Erreur lors de l'ajout de la photo de droite:`, error);
                        // Essayer les formats de secours
                        const fallbackFormats = ['JPEG', 'PNG', 'WEBP'];
                        let success = false;
                        
                        for (const format of fallbackFormats) {
                            if (format !== rightFormat) {
                                try {
                                    doc.addImage(rightPhoto.dataUrl, format, rightX, currentY, rightWidth, rightHeight);
                                    console.log(`✅ Photo de droite ajoutée avec format de secours ${format}`);
                                    success = true;
                                    
                                    // Ajouter le nom de la photo sous l'image
                                    const rightNameY = currentY + rightHeight + 3;
                                    addText(`${rightPhoto.name}`, rightX, rightNameY, rightWidth, { fontSize: 8 });
                                    break;
                                } catch (fallbackError) {
                                    console.error(`❌ Échec du format de secours ${format}:`, fallbackError);
                                }
                            }
                        }
                        
                        if (!success) {
                            // Ajouter un message d'erreur à la place de l'image
                            doc.setTextColor(255, 0, 0);
                            addText(`[Erreur: ${rightPhoto.name}]`, rightX, currentY + 20, rightWidth, { fontSize: 9 });
                            doc.setTextColor(0, 0, 0);
                        }
                    }
                    
                    rowHeight = Math.max(rowHeight, rightHeight + 15);
                } catch (error) {
                    console.error(`❌ Erreur lors du traitement de la photo de droite:`, error);
                    const rightX = margin + 10 + photoMaxWidth + horizontalSpacing;
                    doc.setTextColor(255, 0, 0);
                    addText(`[Erreur: ${rightPhoto.name}]`, rightX, currentY + 20, photoMaxWidth, { fontSize: 9 });
                    doc.setTextColor(0, 0, 0);
                    rowHeight = Math.max(rowHeight, 35);
                }
            }
            
            // Mettre à jour la position Y pour la prochaine ligne
            currentY += rowHeight + 10;
            
            // Vérifier s'il faut ajouter une nouvelle page pour la prochaine ligne
            if (i + 2 < validPhotos.length) {
                checkPageBreak(photoMaxHeight + 30);
            }
        }
        
        return currentY;
    }
    
    function addSection(title) {
        checkPageBreak(20);
        currentY += 10;
        currentY = addText(title, margin, currentY, pageWidth - 2 * margin, {
            fontSize: 14,
            fontStyle: 'bold'
        });
        currentY += 5;
    }
    
    // Title and header
    currentY = addText('ÉTAT DES LIEUX ASCENSEUR', pageWidth/2 - 60, currentY, pageWidth - 2 * margin, {
        fontSize: 18,
        fontStyle: 'bold'
    });
    currentY += 15;
    
    // Generation info
    const now = new Date();
    currentY = addText(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`, 
        margin, currentY, pageWidth - 2 * margin, { fontSize: 8 });
    currentY += 15;
    
    // Field labels mapping with complete labels
    const fieldLabels = {
        adresse: 'Adresse du site',
        numero_appareil: 'Numéro d\'appareil',
        fabricant: 'Fabricant',
        annee_installation: 'Année d\'installation',
        date_visite: 'Date de visite',
        nom_technicien: 'Nom du technicien',
        interlocuteur_client: 'Interlocuteur client',
        
        // Cabine
        etat_interieur: 'État général intérieur',
        etat_interieur_obs: 'Observations état intérieur',
        boutons_commande: 'Boutons de commande',
        boutons_obs: 'Détails boutons',
        eclairage: 'Éclairage cabine',
        eclairage_obs: 'Détails éclairage',
        signalisation: 'Signalisation sonore/visuelle',
        signalisation_obs: 'Détails signalisation',
        nivellement: 'Nivellement',
        nivellement_obs: 'Détails nivellement',
        
        // Portes Palières
        type_porte: 'Type de porte',
        fonctionnement_portes: 'Fonctionnement des portes',
        fonctionnement_obs: 'Détails par étage',
        dispositifs_securite: 'Dispositifs de sécurité',
        securite_obs: 'Détails sécurité',
        alignement: 'Alignement et état mécanique',
        alignement_obs: 'Détails alignement',
        proprete_rails: 'Propreté rails et seuils',
        proprete_obs: 'Détails propreté',
        
        // Porte Cabine
        etat_porte_cabine: 'État général porte cabine',
        porte_cabine_obs: 'Observations porte cabine',
        mecanisme_ouverture: 'Mécanisme d\'ouverture',
        mecanisme_obs: 'Détails mécanisme',
        securite_porte_cabine: 'Sécurité porte cabine',
        securite_porte_obs: 'Détails sécurité porte',
        
        // Toit de Cabine
        etat_toit: 'État général toit cabine',
        toit_obs: 'Observations toit',
        acces_toit: 'Accès toit cabine',
        acces_toit_obs: 'Détails accès toit',
        equipements_toit: 'Équipements sur toit',
        equipements_obs: 'Détails équipements',
        
        // Commande et Sécurité
        manoeuvre_secours: 'Manœuvre de secours',
        manoeuvre_obs: 'Détails manœuvre',
        parachute: 'Parachute',
        parachute_obs: 'Détails parachute',
        fins_courses: 'Fins de courses',
        fins_courses_obs: 'Détails fins de courses',
        alarme_telephone: 'Voyant d\'alarme/téléphone',
        alarme_obs: 'Détails alarme',
        
        // Gaines et Cuvette
        proprete_gaine: 'Propreté gaine et cuvette',
        proprete_gaine_obs: 'Détails gaine',
        etat_cables: 'État des câbles/chaînes',
        cables_obs: 'Détails câbles',
        lubrification: 'Lubrification pièces',
        lubrification_obs: 'Détails lubrification',
        poulie_tendeuse: 'Poulie tendeuse',
        poulie_tendeuse_obs: 'Détails poulie tendeuse',
        cablette_limiteur: 'Câblette limiteur',
        cablette_obs: 'Détails câblette',
        bouton_stop_cuvette: 'Bouton stop cuvette',
        bouton_stop_obs: 'Détails bouton stop',
        
        // Contrepoids
        contrepoids_etat: 'Vérification contrepoids',
        contrepoids_obs: 'Détails contrepoids',
        poulies_galets: 'Inspection poulies/galets',
        poulies_obs: 'Détails poulies',
        
        // Local Machine
        acces_securise: 'Accès sécurisé',
        acces_obs: 'Détails accès',
        moteur_armoire: 'État moteur/armoire électrique',
        moteur_obs: 'Détails moteur',
        proprete_local: 'Propreté et rangement',
        proprete_local_obs: 'Détails propreté local',
        schemas_notices: 'Schémas et notices présents',
        schemas_obs: 'Détails schémas',
        boitier_rappel: 'Boîtier de rappel',
        boitier_rappel_obs: 'Détails boîtier rappel',
        differentiel_dtu: 'Différentiel DTU',
        differentiel_obs: 'Détails différentiel',
        bloc_secours: 'Bloc secours',
        bloc_secours_obs: 'Détails bloc secours',
        kit_consignation: 'Kit de consignation DTU',
        kit_consignation_obs: 'Détails kit consignation',
        verrou_anti_panique: 'Verrou anti panique',
        verrou_obs: 'Détails verrou',
        eclairage_machinerie: 'Éclairage machinerie',
        eclairage_machinerie_obs: 'Détails éclairage machinerie',
        
        // Conclusion
        anomalies_constatees: 'Anomalies constatées',
        pieces_vetustes: 'Pièces vétustes repérées',
        urgences_suggestions: 'Urgences/Suggestions',
        conclusion_generale: 'Conclusion générale',
        
        // Signatures
        nom_technicien_final: 'Nom du technicien (signature)',
        signature_technicien: 'Signé par le technicien',
        nom_client_final: 'Nom du client/gestionnaire',
        signature_client: 'Signé par le client'
    };
    
    // Section titles
    const sectionTitles = [
        '1. IDENTIFICATION',
        '2. CABINE',
        '3. PORTES PALIÈRES',
        '4. PORTE CABINE',
        '5. TOIT DE CABINE',
        '6. COMMANDE ET SÉCURITÉ',
        '7. GAINES ET CUVETTE',
        '8. CONTREPOIDS',
        '9. LOCAL MACHINE',
        '10. CONCLUSION ET OBSERVATIONS',
        '11. SIGNATURES'
    ];
    
    // Generate content by sections
    const fieldsBySection = [
        ['adresse', 'numero_appareil', 'fabricant', 'annee_installation', 'date_visite', 'nom_technicien', 'interlocuteur_client'],
        ['etat_interieur', 'etat_interieur_obs', 'boutons_commande', 'boutons_obs', 'eclairage', 'eclairage_obs', 'signalisation', 'signalisation_obs', 'nivellement', 'nivellement_obs'],
        ['type_porte', 'fonctionnement_portes', 'fonctionnement_obs', 'dispositifs_securite', 'securite_obs', 'alignement', 'alignement_obs', 'proprete_rails', 'proprete_obs'],
        ['etat_porte_cabine', 'porte_cabine_obs', 'mecanisme_ouverture', 'mecanisme_obs', 'securite_porte_cabine', 'securite_porte_obs'],
        ['etat_toit', 'toit_obs', 'acces_toit', 'acces_toit_obs', 'equipements_toit', 'equipements_obs'],
        ['manoeuvre_secours', 'manoeuvre_obs', 'parachute', 'parachute_obs', 'fins_courses', 'fins_courses_obs', 'alarme_telephone', 'alarme_obs'],
        ['proprete_gaine', 'proprete_gaine_obs', 'etat_cables', 'cables_obs', 'lubrification', 'lubrification_obs', 'poulie_tendeuse', 'poulie_tendeuse_obs', 'cablette_limiteur', 'cablette_obs', 'bouton_stop_cuvette', 'bouton_stop_obs'],
        ['contrepoids_etat', 'contrepoids_obs', 'poulies_galets', 'poulies_obs'],
        ['acces_securise', 'acces_obs', 'moteur_armoire', 'moteur_obs', 'proprete_local', 'proprete_local_obs', 'schemas_notices', 'schemas_obs', 'boitier_rappel', 'boitier_rappel_obs', 'differentiel_dtu', 'differentiel_obs', 'bloc_secours', 'bloc_secours_obs', 'kit_consignation', 'kit_consignation_obs', 'verrou_anti_panique', 'verrou_obs', 'eclairage_machinerie', 'eclairage_machinerie_obs'],
        ['anomalies_constatees', 'pieces_vetustes', 'urgences_suggestions', 'conclusion_generale'],
        ['nom_technicien_final', 'signature_technicien', 'nom_client_final', 'signature_client']
    ];
    
    // Generate content by sections
    for (let sectionIndex = 0; sectionIndex < sectionTitles.length; sectionIndex++) {
        const sectionTitle = sectionTitles[sectionIndex];
        const sectionFields = fieldsBySection[sectionIndex] || [];
        
        // Check if section has any data
        const hasData = sectionFields.some(field => {
            const value = formData[field];
            return value !== undefined && value !== null && value !== '';
        });
        
        if (hasData) {
            addSection(sectionTitle);
            
            sectionFields.forEach(fieldName => {
                const fieldValue = formData[fieldName];
                const fieldLabel = fieldLabels[fieldName] || fieldName;
                
                if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                    checkPageBreak(15);
                    
                    let displayValue = fieldValue;
                    if (typeof fieldValue === 'boolean') {
                        displayValue = fieldValue ? 'Oui' : 'Non';
                    }
                    
                    currentY = addText(`${fieldLabel}: ${displayValue}`, 
                        margin, currentY, pageWidth - 2 * margin, { fontSize: 10 });
                    currentY += 3;
                }
            });
            
            // Add photos if they exist for this section
            console.log(`📸 SECTION ${sectionIndex} - Vérification des photos...`);
            console.log(`📸 SECTION ${sectionIndex} - Type de sectionPhotos: ${typeof sectionPhotos}`);
            console.log(`📸 SECTION ${sectionIndex} - sectionPhotos est un tableau? ${Array.isArray(sectionPhotos)}`);
            console.log(`📸 SECTION ${sectionIndex} - Clés de sectionPhotos: ${Object.keys(sectionPhotos).join(', ')}`);
            
            // Vérifier si sectionPhotos[sectionIndex] existe
            if (sectionPhotos[sectionIndex] === undefined) {
                console.warn(`⚠️ SECTION ${sectionIndex} - Aucune entrée dans sectionPhotos pour cette section`);
            } else {
                console.log(`📸 SECTION ${sectionIndex} - Type de sectionPhotos[${sectionIndex}]: ${typeof sectionPhotos[sectionIndex]}`);
                console.log(`📸 SECTION ${sectionIndex} - sectionPhotos[${sectionIndex}] est un tableau? ${Array.isArray(sectionPhotos[sectionIndex])}`);
            }
            
            const photos = sectionPhotos[sectionIndex];
            console.log(`🔍 SECTION ${sectionIndex} - Photos trouvées:`, photos);
            
            // Vérification approfondie de l'état des photos
            if (photos) {
                if (Array.isArray(photos)) {
                    console.log(`📸 SECTION ${sectionIndex} - ${photos.length} photos trouvées`);
                    
                    // Vérifier chaque photo
                    photos.forEach((photo, idx) => {
                        console.log(`📸 SECTION ${sectionIndex} - Photo ${idx+1}:`);
                        console.log(`   - Nom: ${photo.name || 'Non défini'}`);
                        console.log(`   - ID: ${photo.id || 'Non défini'}`);
                        console.log(`   - URL: ${photo.url ? 'Présente' : 'MANQUANTE'}`);
                        console.log(`   - dataUrl: ${photo.dataUrl ? `Présente (${photo.dataUrl.length} caractères)` : 'MANQUANTE'}`);
                        
                        if (photo.dataUrl) {
                            console.log(`   - dataUrl commence par: ${photo.dataUrl.substring(0, 50)}...`);
                            console.log(`   - Type d'image: ${photo.dataUrl.includes('data:image/') ? photo.dataUrl.split(';')[0].split(':')[1] : 'Inconnu'}`);
                        }
                    });
                } else {
                    console.error(`❌ SECTION ${sectionIndex} - photos n'est pas un tableau mais un ${typeof photos}`);
                }
            } else {
                console.warn(`⚠️ SECTION ${sectionIndex} - Aucune photo trouvée`);
            }
            
            if (photos && photos.length > 0) {
                console.log(`🎯 SECTION ${sectionIndex} - ${photos.length} photos à ajouter au PDF`);
                
                // Vérifier si au moins une photo a un dataUrl valide
                const validPhotos = photos.filter(photo => photo.dataUrl && photo.dataUrl.startsWith('data:image/'));
                console.log(`🎯 SECTION ${sectionIndex} - ${validPhotos.length}/${photos.length} photos ont un dataUrl valide`);
                
                if (validPhotos.length === 0) {
                    console.warn(`⚠️ SECTION ${sectionIndex} - Aucune photo avec dataUrl valide, tentative de récupération...`);
                    
                    // Tentative de récupération synchrone des dataUrl
                    const recoveryPromises = [];
                    
                    // Fonction pour détecter le format d'image à partir de l'URL ou du contenu
                    const detectImageFormat = (url, fallback = 'image/jpeg') => {
                        if (!url) return fallback;
                        
                        // Détection par extension de fichier
                        if (url.match(/\.png(\?|#|$)/i)) return 'image/png';
                        if (url.match(/\.jpe?g(\?|#|$)/i)) return 'image/jpeg';
                        if (url.match(/\.webp(\?|#|$)/i)) return 'image/webp';
                        if (url.match(/\.gif(\?|#|$)/i)) return 'image/gif';
                        
                        // Si c'est un dataURL, extraire le type
                        if (url.startsWith('data:image/')) {
                            const match = url.match(/^data:(image\/[^;]+);/);
                            if (match) return match[1];
                        }
                        
                        return fallback;
                    };
                    
                    // Fonction pour déterminer la qualité de compression optimale
                    const getOptimalQuality = (width, height) => {
                        const megapixels = (width * height) / 1000000;
                        
                        // Ajuster la qualité en fonction de la taille de l'image
                        if (megapixels > 8) return 0.6;      // Très grande image
                        if (megapixels > 4) return 0.7;      // Grande image
                        if (megapixels > 2) return 0.8;      // Image moyenne
                        return 0.85;                         // Petite image
                    };
                    
                    // Créer une promesse pour chaque photo qui a besoin de récupération
                    for (const photo of photos) {
                        if (!photo.dataUrl && photo.url) {
                            console.log(`🔄 Tentative de récupération synchrone du dataUrl pour ${photo.name || 'Sans nom'}`);
                            
                            // Ajouter une promesse pour cette photo
                            const recoveryPromise = (async () => {
                                try {
                                    // Créer une image temporaire et un canvas
                                    const tempImg = new Image();
                                    tempImg.crossOrigin = "Anonymous";
                                    
                                    // Attendre que l'image soit chargée (de manière synchrone avec une promesse)
                                    const dataUrlPromise = new Promise((resolve) => {
                                        // Nettoyer les ressources en cas de succès
                                        tempImg.onload = function() {
                                            try {
                                                const canvas = document.createElement('canvas');
                                                canvas.width = tempImg.width;
                                                canvas.height = tempImg.height;
                                                const ctx = canvas.getContext('2d');
                                                ctx.drawImage(tempImg, 0, 0);
                                                
                                                // Déterminer le format et la qualité optimale
                                                const format = detectImageFormat(photo.url);
                                                const quality = getOptimalQuality(tempImg.width, tempImg.height);
                                                
                                                console.log(`📊 Image ${photo.name || 'Sans nom'}: ${tempImg.width}x${tempImg.height} pixels, format: ${format}, qualité: ${quality}`);
                                                
                                                const newDataUrl = canvas.toDataURL(format, quality);
                                                
                                                // Libérer les ressources canvas
                                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                
                                                resolve(newDataUrl);
                                            } catch (canvasError) {
                                                console.error(`❌ Erreur canvas pour ${photo.name || 'Sans nom'}:`, canvasError);
                                                resolve(null);
                                            }
                                        };
                                        
                                        // Gérer les erreurs de chargement
                                        tempImg.onerror = (e) => {
                                            console.error(`❌ Erreur de chargement de l'image ${photo.name || 'Sans nom'}:`, e);
                                            resolve(null);
                                        };
                                        
                                        // Définir un timeout pour éviter de bloquer indéfiniment (5 secondes)
                                        setTimeout(() => {
                                            console.warn(`⏱️ Timeout dépassé pour le chargement de l'image ${photo.name || 'Sans nom'}`);
                                            resolve(null);
                                        }, 5000);
                                    });
                                    
                                    // Charger l'image
                                    tempImg.src = photo.url;
                                    
                                    // Attendre la résolution de la promesse
                                    const newDataUrl = await dataUrlPromise;
                                    
                                    if (newDataUrl && newDataUrl.startsWith('data:image/')) {
                                        photo.dataUrl = newDataUrl;
                                        console.log(`✅ DataUrl récupéré avec succès pour ${photo.name || 'Sans nom'}`);
                                        return true;
                                    } else {
                                        console.warn(`⚠️ Échec de récupération du dataUrl pour ${photo.name || 'Sans nom'}`);
                                        return false;
                                    }
                                } catch (error) {
                                    console.error(`❌ Erreur lors de la récupération du dataUrl pour ${photo.name || 'Sans nom'}:`, error);
                                    return false;
                                }
                            })();
                            
                            recoveryPromises.push(recoveryPromise);
                        }
                    }
                    
                    // Attendre que toutes les récupérations soient terminées (avec un timeout global)
                    if (recoveryPromises.length > 0) {
                        console.log(`🔄 Tentative de récupération de ${recoveryPromises.length} dataUrl...`);
                        
                        try {
                            // Utiliser Promise.all avec un timeout global pour éviter de bloquer trop longtemps
                            const timeoutPromise = new Promise(resolve => setTimeout(() => {
                                console.warn(`⏱️ Timeout global dépassé pour la récupération des dataUrl`);
                                resolve([]);
                            }, 10000)); // 10 secondes maximum pour toutes les récupérations
                            
                            // Attendre soit que toutes les promesses soient résolues, soit que le timeout soit atteint
                            await Promise.race([
                                Promise.all(recoveryPromises),
                                timeoutPromise
                            ]);
                            
                            console.log(`✅ Récupération des dataUrl terminée`);
                        } catch (error) {
                            console.error(`❌ Erreur lors de la récupération des dataUrl:`, error);
                        }
                    }
                }
                
                // Vérifier à nouveau les photos valides après tentative de récupération
                const finalValidPhotos = photos.filter(photo => photo.dataUrl && photo.dataUrl.startsWith('data:image/'));
                console.log(`🎯 SECTION ${sectionIndex} - Après récupération: ${finalValidPhotos.length}/${photos.length} photos ont un dataUrl valide`);
                
                if (finalValidPhotos.length > 0) {
                    checkPageBreak(15);
                    currentY = addText(`Photos associées: ${finalValidPhotos.length}`, 
                        margin, currentY, pageWidth - 2 * margin, { fontSize: 10, fontStyle: 'bold' });
                    currentY += 8;
                    
                    // Utiliser la grille de photos si plus d'une photo
                    if (finalValidPhotos.length > 1) {
                        currentY = await addPhotosGrid(finalValidPhotos, currentY);
                    } else {
                        // Sinon, utiliser l'affichage standard pour une seule photo
                        // Add photos to PDF - use pre-stored dataUrl
                        for (let i = 0; i < photos.length; i++) {
                        const photo = photos[i];
                        console.log(`🔍 Traitement de la photo ${i + 1}/${photos.length}: ${photo.name}`);
                        console.log(`🔍 Propriétés de la photo:`, Object.keys(photo).join(', '));
                        
                        try {
                            // Use the pre-stored dataUrl
                            let dataUrl = photo.dataUrl;
                            
                            if (!dataUrl) {
                                console.error(`❌ Pas de dataUrl trouvé pour la photo ${photo.name}`);
                                console.error(`❌ Propriétés disponibles:`, Object.keys(photo).join(', '));
                                
                                // Tentative de récupération à partir de l'URL si disponible
                                if (photo.url) {
                                    console.log(`🔄 Tentative de récupération du dataUrl à partir de l'URL pour ${photo.name}`);
                                    try {
                                        // Cette partie ne fonctionnera pas pour les blob URLs en raison des restrictions CORS
                                        // Mais nous l'incluons pour le débogage
                                        const tempImg = new Image();
                                        tempImg.crossOrigin = "Anonymous";
                                        
                                        // Utiliser une promesse pour attendre le chargement
                                        const dataUrlPromise = new Promise((resolve) => {
                                            tempImg.onload = function() {
                                                try {
                                                    const canvas = document.createElement('canvas');
                                                    canvas.width = tempImg.width;
                                                    canvas.height = tempImg.height;
                                                    const ctx = canvas.getContext('2d');
                                                    ctx.drawImage(tempImg, 0, 0);
                                                    const newDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                                    resolve(newDataUrl);
                                                } catch (error) {
                                                    console.error(`❌ Erreur canvas:`, error);
                                                    resolve(null);
                                                }
                                            };
                                            tempImg.onerror = () => {
                                                console.error(`❌ Erreur de chargement de l'image`);
                                                resolve(null);
                                            };
                                            
                                            // Définir un timeout pour éviter de bloquer indéfiniment
                                            setTimeout(() => resolve(null), 2000);
                                        });
                                        
                                        // Charger l'image
                                        tempImg.src = photo.url;
                                        
                                        // Attendre la résolution de la promesse
                                        dataUrl = await dataUrlPromise;
                                        if (dataUrl) {
                                            photo.dataUrl = dataUrl;
                                            console.log(`✅ DataUrl récupéré avec succès pour ${photo.name}`);
                                        }
                                    } catch (urlError) {
                                        console.error(`❌ Erreur lors de la récupération depuis l'URL:`, urlError);
                                    }
                                }
                            }
                            
                            if (!photo.dataUrl) {
                                console.warn(`⚠️ Impossible de récupérer le dataUrl pour la photo ${photo.name}`);
                                console.error(`❌ Impossible de récupérer un dataUrl pour ${photo.name}, passage à la photo suivante`);
                                continue;
                            }
                            
                            // Vérifier que le dataUrl est valide
                            if (!dataUrl.startsWith('data:image/')) {
                                console.error(`❌ Format de dataUrl invalide pour la photo ${photo.name}`);
                                continue;
                            }
                            
                            console.log(`✅ DataUrl trouvé pour ${photo.name}, longueur: ${dataUrl.length} caractères`);
                            console.log(`✅ DataUrl commence par: ${dataUrl.substring(0, 100)}`);
                            
                            // Create image to get dimensions
                            const img = await new Promise((resolve, reject) => {
                                const image = new Image();
                                
                                image.onload = () => {
                                    console.log(`✅ Image chargée avec succès: ${image.width}x${image.height}`);
                                    resolve(image);
                                };
                                
                                image.onerror = (e) => {
                                    console.error(`❌ Erreur de chargement de l'image ${photo.name || 'Sans nom'}:`, e);
                                    reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                                };
                                
                                // Timeout pour éviter de bloquer indéfiniment
                                const timeoutId = setTimeout(() => {
                                    console.error(`⏱️ Timeout dépassé pour le chargement de l'image ${photo.name || 'Sans nom'}`);
                                    reject(new Error('Timeout de chargement d\'image dépassé'));
                                }, 8000); // 8 secondes de timeout
                                
                                // Nettoyer le timeout si l'image est chargée ou en erreur
                                image.onload = () => {
                                    clearTimeout(timeoutId);
                                    console.log(`✅ Image chargée avec succès: ${image.width}x${image.height}`);
                                    resolve(image);
                                };
                                
                                image.onerror = (e) => {
                                    clearTimeout(timeoutId);
                                    console.error(`❌ Erreur de chargement de l'image ${photo.name || 'Sans nom'}:`, e);
                                    reject(new Error(`Erreur de chargement de l'image: ${e.message || 'Raison inconnue'}`));
                                };
                                
                                console.log(`🔄 Chargement de l'image à partir du dataUrl...`);
                                image.src = dataUrl;
                            }).catch(error => {
                                console.error(`❌ Échec du chargement de l'image:`, error);
                                throw error; // Propager l'erreur pour être capturée par le bloc catch externe
                            });
                            
                            // Vérifier que l'image a été chargée correctement
                            if (!img || !img.width || !img.height) {
                                console.error(`❌ Image invalide ou dimensions nulles pour ${photo.name || 'Sans nom'}`);
                                throw new Error('Image invalide ou dimensions nulles');
                            }
                            
                            // Calculate scaled dimensions
                            const maxWidth = pageWidth - 2 * margin - 20;
                            const maxHeight = 120;
                            
                            let width = img.width;
                            let height = img.height;
                            
                            // Scale to fit
                            const widthRatio = maxWidth / width;
                            const heightRatio = maxHeight / height;
                            const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale
                            
                            width = width * scale;
                            height = height * scale;
                            
                            // Vérifier que les dimensions sont valides
                            if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
                                console.error(`❌ Dimensions invalides après mise à l'échelle: ${width}x${height}`);
                                throw new Error('Dimensions d\'image invalides après mise à l\'échelle');
                            }
                            
                            console.log(`📏 Final dimensions: ${width}x${height} (scale: ${scale})`);
                            
                            // Check page space
                            checkPageBreak(height + 20);
                            
                            console.log(`📍 Current Y position: ${currentY}`);
                            console.log(`📍 Will add image at: (${margin + 10}, ${currentY})`);
                            
                            // Détection plus robuste du format d'image
                            let imageFormat = 'JPEG'; // Format par défaut
                            
                            if (dataUrl.includes('data:image/png')) {
                                imageFormat = 'PNG';
                            } else if (dataUrl.includes('data:image/webp')) {
                                imageFormat = 'WEBP';
                            } else if (dataUrl.includes('data:image/jpeg') || dataUrl.includes('data:image/jpg')) {
                                imageFormat = 'JPEG';
                            } else if (dataUrl.includes('data:image/gif')) {
                                imageFormat = 'GIF';
                            }
                            
                            console.log(`🎨 Using image format: ${imageFormat}`);
                            
                            // Liste des formats à essayer en cas d'échec
                            const fallbackFormats = ['JPEG', 'PNG', 'WEBP'];
                            
                            // Essayer d'abord avec le format détecté
                            let success = false;
                            let lastError = null;
                            
                            try {
                                doc.addImage(dataUrl, imageFormat, margin + 10, currentY, width, height);
                                console.log(`🎉 SUCCESS! Image added to PDF with format ${imageFormat}`);
                                success = true;
                            } catch (addImageError) {
                                console.error(`❌ Error with format ${imageFormat}:`, addImageError);
                                lastError = addImageError;
                                
                                // Essayer les formats de secours
                                for (const format of fallbackFormats) {
                                    if (format !== imageFormat) { // Ne pas réessayer le même format
                                        try {
                                            console.log(`🔄 Trying ${format} fallback...`);
                                            doc.addImage(dataUrl, format, margin + 10, currentY, width, height);
                                            console.log(`🎉 SUCCESS with ${format} fallback!`);
                                            success = true;
                                            break;
                                        } catch (fallbackError) {
                                            console.error(`❌ ${format} fallback failed:`, fallbackError);
                                            lastError = fallbackError;
                                        }
                                    }
                                }
                                
                                if (!success) {
                                    console.error(`❌ All image format attempts failed`);
                                    throw lastError || new Error('Échec de l\'ajout de l\'image au PDF');
                                }
                            }
                            
                            // Add photo name below image
                            currentY += height + 3;
                            currentY = addText(`${photo.name}`, margin + 10, currentY, width, { fontSize: 8 });
                            currentY += 8;
                            
                            console.log(`✅ Photo ${i + 1} (${photo.name}) completed! New Y position: ${currentY}`);
                        } catch (error) {
                            console.error(`💥 ERROR processing photo ${photo.name || 'Sans nom'}:`, error);
                            console.error(`💥 Error stack:`, error.stack);
                            
                            // Ajouter une icône d'erreur et un message explicatif plus visuel
                            try {
                                // Hauteur du bloc d'erreur
                                const errorBoxHeight = 60;
                                
                                // Vérifier s'il faut ajouter une nouvelle page
                                checkPageBreak(errorBoxHeight + 10);
                                
                                // Ajouter un rectangle rouge pour indiquer l'erreur avec un dégradé
                                const gradientX = margin + 10;
                                const gradientY = currentY;
                                const gradientWidth = maxWidth - 20;
                                const gradientHeight = errorBoxHeight;
                                
                                // Créer un dégradé de couleur pour le fond (du rouge clair au blanc)
                                const grd = doc.setGState(doc.GState({opacity: 0.3}));
                                doc.setFillColor(255, 240, 240); // Fond rouge très clair
                                doc.roundedRect(gradientX, gradientY, gradientWidth, gradientHeight, 5, 5, 'F');
                                doc.setGState(doc.GState({opacity: 1}));
                                
                                // Ajouter une bordure rouge
                                doc.setDrawColor(220, 53, 69); // Rouge bootstrap
                                doc.setLineWidth(0.5);
                                doc.roundedRect(gradientX, gradientY, gradientWidth, gradientHeight, 5, 5, 'S');
                                
                                // Ajouter un symbole d'avertissement
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(220, 53, 69); // Rouge bootstrap
                                doc.setFontSize(20);
                                doc.text('⚠️', gradientX + 15, gradientY + 25);
                                
                                // Ajouter le titre de l'erreur
                                doc.setFontSize(12);
                                doc.text(`Impossible d'ajouter la photo`, gradientX + 35, gradientY + 20);
                                
                                // Ajouter le nom de la photo
                                doc.setFont('helvetica', 'normal');
                                doc.setFontSize(10);
                                doc.text(`Nom: ${photo.name || 'Sans nom'}`, gradientX + 35, gradientY + 32);
                                
                                // Ajouter le message d'erreur
                                doc.setTextColor(100, 0, 0); // Rouge plus foncé pour le détail
                                doc.setFontSize(8);
                                
                                // Tronquer le message d'erreur s'il est trop long
                                let errorMessage = error.message || 'Erreur inconnue';
                                if (errorMessage.length > 80) {
                                    errorMessage = errorMessage.substring(0, 77) + '...';
                                }
                                
                                doc.text(`Erreur: ${errorMessage}`, gradientX + 35, gradientY + 42);
                                
                                // Ajouter un conseil
                                doc.setTextColor(100, 100, 100); // Gris pour le conseil
                                doc.text('Conseil: Vérifiez le format de l\'image ou réessayez avec une autre photo', 
                                    gradientX + 35, gradientY + 52);
                                
                                // Restaurer les couleurs et polices par défaut
                                doc.setTextColor(0, 0, 0);
                                doc.setDrawColor(0, 0, 0);
                                doc.setFillColor(255, 255, 255);
                                doc.setFont('helvetica', 'normal');
                                doc.setFontSize(12);
                                doc.setLineWidth(0.2);
                                
                                // Mettre à jour la position Y
                                currentY += errorBoxHeight + 10;
                            } catch (formatError) {
                                // En cas d'erreur lors de la mise en forme, utiliser une approche plus simple
                                console.error(`❌ Erreur lors de l'affichage du message d'erreur:`, formatError);
                                doc.setTextColor(255, 0, 0); // Texte en rouge
                                currentY = addText(`Photo ${i + 1}: ${photo.name || 'Sans nom'} (erreur: ${error.message || 'Erreur inconnue'})`, 
                                    margin + 10, currentY, pageWidth - 2 * margin - 20, { fontSize: 9 });
                                doc.setTextColor(0, 0, 0); // Restaurer la couleur par défaut
                                currentY += 15;
                            }
                        }
                        }
                    }
                }
                currentY += 5;
            }
        }
    }
    
    // Add footer
    checkPageBreak(20);
    currentY += 20;
    currentY = addText('Fin du rapport', pageWidth/2 - 30, currentY, pageWidth - 2 * margin, {
        fontSize: 12,
        fontStyle: 'bold'
    });
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay show';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>Génération du PDF en cours...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function removeLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// New inspection
function newInspection() {
    if (confirm('Êtes-vous sûr de vouloir commencer une nouvelle inspection ? Toutes les données actuelles seront effacées.')) {
        // Clear photo URLs
        Object.values(sectionPhotos).flat().forEach(photo => {
            URL.revokeObjectURL(photo.url);
        });
        
        // Clear data
        formData = {};
        completedSections.clear();
        sectionPhotos = {};
        currentSection = 0;
        
        // Reset form
        if (form) {
            form.reset();
        }
        
        // Clear photo previews
        document.querySelectorAll('.photo-preview').forEach(preview => {
            preview.innerHTML = '';
        });
        
        // Set default date
        setDefaultValues();
        
        // Clear sessionStorage
        try {
            sessionStorage.removeItem('elevatorInspection');
        } catch (error) {
            console.warn('Unable to clear sessionStorage:', error);
        }
        
        // Reset UI
        goToSection(0);
        
        showToast('Nouvelle inspection créée.', 'success');
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                if (currentSection > 0) goToSection(currentSection - 1);
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextSection();
                break;
            case 's':
                event.preventDefault();
                saveFormData();
                showToast('Données sauvegardées manuellement.', 'success');
                break;
            case 'p':
                if (currentSection === sections.length - 1) {
                    event.preventDefault();
                    generatePDF();
                }
                break;
        }
    }
    
    // Escape key to close any modals or overlays
    if (event.key === 'Escape') {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function(event) {
    // Save data one final time
    saveFormData();
    
    // Clear auto-save timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    // Clean up photo URLs
    Object.values(sectionPhotos).flat().forEach(photo => {
        if (photo && photo.url) {
            URL.revokeObjectURL(photo.url);
        }
    });
});

// Debug helpers
window.elevatorInspectionDebug = {
    getFormData: () => formData,
    getCompletedSections: () => Array.from(completedSections),
    getCurrentSection: () => currentSection,
    getSectionPhotos: () => sectionPhotos,
    goToSection: goToSection,
    validateCurrentSection: validateCurrentSection,
    showToast: showToast,
    updateProgress: updateProgress
};

console.log('Elevator Inspection App loaded. Debug tools available at window.elevatorInspectionDebug');