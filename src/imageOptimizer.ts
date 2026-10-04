import heic2any from 'heic2any';
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/**
 * Verifica se o arquivo é do formato HEIC ou HEIF (fotos nativas de iPhone/iPad)
 */
export function isHeicFile(file: File | Blob, fileName?: string): boolean {
  const name = (fileName || (file instanceof File ? file.name : '')).toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    type.includes('heic') ||
    type.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

/**
 * Converte client-side arquivos HEIC/HEIF para Blob JPEG usando a biblioteca heic2any
 */
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.error("Erro na conversão client-side heic2any:", err);
    throw new Error("Não foi possível decodificar a foto do iPhone (HEIC). Verifique se o arquivo não está corrompido.");
  }
}

/**
 * Redimensiona a imagem para no máximo 1000x1000px mantendo a proporção original,
 * e comprime o arquivo de forma inteligente para que fique entre 150 KB e 250 KB.
 */
export async function compressAndResizeImage(source: Blob | File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxDim = 1000;

      // Mantém proporção com teto de 1000x1000
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Falha ao obter contexto 2D para renderização no Canvas."));
        return;
      }

      // Fundo branco para garantir renderização limpa sem artefatos
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const tryCompress = (format: string, quality: number): Promise<Blob> => {
        return new Promise((res, rej) => {
          canvas.toBlob((blob) => {
            if (blob) res(blob);
            else rej(new Error("Falha ao exportar blob comprimido."));
          }, format, quality);
        });
      };

      const executeOptimization = async () => {
        try {
          // Formato WebP preferencial (alta performance e fidelidade)
          const format = 'image/webp';
          let quality = 0.84;
          let blob = await tryCompress(format, quality);

          // Alvo: entre 150 KB e 250 KB
          const maxBytes = 250 * 1024;
          const minBytes = 150 * 1024;

          // Se passar de 250 KB, reduz qualidade gradualmente
          if (blob.size > maxBytes) {
            quality = 0.72;
            blob = await tryCompress(format, quality);
          }
          if (blob.size > maxBytes) {
            quality = 0.60;
            blob = await tryCompress(format, quality);
          }

          // Se ficou abaixo de 150 KB e a imagem original tem resolução, tenta qualidade máxima (0.95)
          if (blob.size < minBytes) {
            const highQualityBlob = await tryCompress(format, 0.95);
            if (highQualityBlob.size <= maxBytes) {
              blob = highQualityBlob;
            }
          }

          resolve(blob);
        } catch (e) {
          // Fallback para JPEG caso o browser não suporte compressão toBlob webp
          try {
            const fallbackBlob = await tryCompress('image/jpeg', 0.82);
            resolve(fallbackBlob);
          } catch (errFinal) {
            reject(errFinal);
          }
        }
      };

      executeOptimization();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Erro ao carregar a imagem na memória."));
    };

    img.src = objectUrl;
  });
}

/**
 * Pipeline Universal de Upload:
 * 1. Converte fotos de iPhone (HEIC/HEIF) para JPEG
 * 2. Redimensiona para resolução máx 1000x1000 e comprime entre 150 KB e 250 KB
 * 3. Envia o blob para o Firebase Storage na pasta `produtos/`
 * 4. Retorna a URL de download pública e permanente
 */
export async function uploadProductPhotoToFirebase(
  file: File,
  productId: string | number,
  onProgress?: (progressPercent: number, statusMsg: string) => void
): Promise<string> {
  // 1. Verificação e Conversão de HEIC/HEIF
  let processedBlob: Blob = file;
  if (isHeicFile(file)) {
    if (onProgress) onProgress(15, "Convertendo foto do iPhone (HEIC para JPEG)...");
    processedBlob = await convertHeicToJpeg(file);
  }

  // 2. Redimensionamento e Compressão Inteligente
  if (onProgress) onProgress(35, "Otimizando resolução (máx 1000x1000) e comprimindo (150-250 KB)...");
  const optimizedBlob = await compressAndResizeImage(processedBlob);

  // 3. Upload para o Firebase Storage
  if (onProgress) onProgress(60, "Conectando ao Firebase Storage...");
  const sanitizedId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const extension = optimizedBlob.type.includes('webp') ? 'webp' : 'jpg';
  const filePath = `produtos/prod_${sanitizedId}_${Date.now()}.${extension}`;
  const fileRef = ref(storage, filePath);

  const uploadTask = uploadBytesResumable(fileRef, optimizedBlob, {
    contentType: optimizedBlob.type,
    cacheControl: 'public, max-age=31536000'
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 35) + 60;
        if (onProgress) onProgress(pct, `Enviando foto ao Storage: ${pct}%`);
      },
      (error) => {
        console.error("Erro no upload do Firebase Storage:", error);
        reject(error);
      },
      async () => {
        try {
          if (onProgress) onProgress(98, "Obtendo link público...");
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (onProgress) onProgress(100, "Upload concluído com sucesso!");
          resolve(downloadUrl);
        } catch (errUrl) {
          reject(errUrl);
        }
      }
    );
  });
}
