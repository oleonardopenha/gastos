import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadCSV(content: string, filename: string): Promise<void> {
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Exportar gastos' });
  }
}
