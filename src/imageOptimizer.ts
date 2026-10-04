import heic2any from 'heic2any';

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
      quality: 0.85
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.error("Erro na conversão client-side heic2any:", err);
    throw new Error("Não foi possível decodificar a foto do iPhone (HEIC). Verifique se o arquivo não está corrompido.");
  }
}

/**
 * Fluxo Autônomo de Compressão de Imagem (Direto para Base64 WebP):
 * 1. Detecta e converte fotos de iPhone (HEIC/HEIF) para JPEG client-side.
 * 2. Redimensiona via HTML5 Canvas para largura máxima de 800px (mantendo proporção).
 * 3. Comprime com qualidade 0.7 em formato 'image/webp' (com fallback para 'image/jpeg').
 * 4. Retorna a string Base64 definitiva ("data:image/webp;base64,...") para armazenamento direto no Firestore.
 */
export async function compressImageToBase64Webp(
  file: File | Blob,
  onProgress?: (progressPercent: number, statusMsg: string) => void
): Promise<string> {
  if (onProgress) onProgress(10, "Lendo arquivo de imagem...");

  // 1. Tratamento e conversão de fotos do iPhone (HEIC/HEIF)
  let sourceBlob: Blob = file;
  if (file instanceof File && isHeicFile(file)) {
    if (onProgress) onProgress(30, "Convertendo foto do iPhone (HEIC para JPEG)...");
    sourceBlob = await convertHeicToJpeg(file);
  }

  if (onProgress) onProgress(50, "Carregando imagem no Canvas...");

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(sourceBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        if (onProgress) onProgress(70, "Redimensionando para máx 800px e otimizando WebP...");

        let { width, height } = img;
        const maxWidth = 800;
        const maxHeight = 1000;

        // Mantém proporção com largura máxima de 800px
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // Teto de altura máxima para imagens extremamente verticais
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Falha ao inicializar o Canvas para processamento gráfico."));
          return;
        }

        // Fundo branco limpo para evitar artefatos escuros em imagens com canal alpha
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (onProgress) onProgress(90, "Gerando string Base64 WebP otimizada...");

        // Qualidade 0.7 em formato WebP
        let base64Result = canvas.toDataURL('image/webp', 0.7);

        // Fallback para JPEG caso o navegador não suporte toDataURL em formato WebP
        if (!base64Result.startsWith('data:image/webp')) {
          base64Result = canvas.toDataURL('image/jpeg', 0.75);
        }

        if (onProgress) onProgress(100, "Foto otimizada com sucesso!");
        resolve(base64Result);
      } catch (procErr) {
        reject(procErr);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao decodificar a imagem selecionada."));
    };

    img.src = objectUrl;
  });
}

/**
 * Redimensiona e comprime a imagem retornando Blob (compatibilidade com utilitários legados).
 */
export async function compressAndResizeImage(source: Blob | File): Promise<Blob> {
  const base64 = await compressImageToBase64Webp(source);
  const res = await fetch(base64);
  return await res.blob();
}

/**
 * Alias universal e retrocompatível: opera em modo 100% autônomo (Base64 WebP),
 * sem dependência externa do Firebase Storage para eliminar travamentos e bloqueios de CORS.
 */
export async function uploadProductPhotoToFirebase(
  file: File,
  _productId?: string | number,
  onProgress?: (progressPercent: number, statusMsg: string) => void
): Promise<string> {
  return compressImageToBase64Webp(file, onProgress);
}
