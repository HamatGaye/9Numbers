import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { migrateGambianNumber } from '../utils/migration';

type AppState = 'welcome' | 'scanning' | 'review' | 'updating' | 'success';

interface MigratableContact {
  id: string;
  name: string;
  originalContact: any;
  numbersToUpdate: {
    id: string | undefined;
    originalNumber: string;
    migratedNumber: string;
  }[];
  selected: boolean;
}

export default function HomeScreen() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [migratableContacts, setMigratableContacts] = useState<MigratableContact[]>([]);
  const [updateCount, setUpdateCount] = useState(0);

  const startScanning = async () => {
    setAppState('scanning');
    const { status } = await Contacts.requestPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need contacts permission to migrate your phone numbers.');
      setAppState('welcome');
      return;
    }

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data.length > 0) {
        const toMigrate: MigratableContact[] = [];

        for (const contact of data) {
          if (!contact.phoneNumbers) continue;

          const numbersToUpdate: MigratableContact['numbersToUpdate'] = [];

          for (const phone of contact.phoneNumbers) {
            if (!phone.number) continue;

            const result = migrateGambianNumber(phone.number);
            if (result.needsMigration) {
              numbersToUpdate.push({
                id: phone.id,
                originalNumber: phone.number,
                migratedNumber: result.migratedNumber,
              });
            }
          }

          if (numbersToUpdate.length > 0) {
            toMigrate.push({
              id: contact.id || Math.random().toString(),
              name: contact.name || 'Unknown Contact',
              originalContact: contact,
              numbersToUpdate,
              selected: true,
            });
          }
        }

        setMigratableContacts(toMigrate);
        setAppState('review');
      } else {
        Alert.alert('No Contacts', 'No contacts found on this device.');
        setAppState('welcome');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to scan contacts.');
      setAppState('welcome');
    }
  };

  const toggleContactSelection = (index: number) => {
    const updated = [...migratableContacts];
    updated[index].selected = !updated[index].selected;
    setMigratableContacts(updated);
  };

  const performUpdate = async () => {
    setAppState('updating');
    let count = 0;

    // For safety, let's store a backup mapping in AsyncStorage
    const backupLog: any[] = [];

    for (const item of migratableContacts) {
      if (!item.selected) continue;

      const newContact = { ...item.originalContact };
      let modified = false;

      if (newContact.phoneNumbers) {
        newContact.phoneNumbers = newContact.phoneNumbers.map((phone: any) => {
          const update = item.numbersToUpdate.find(u => u.id === phone.id || u.originalNumber === phone.number);
          if (update) {
            backupLog.push({
              contactId: newContact.id,
              phoneId: phone.id,
              oldNumber: phone.number,
              newNumber: update.migratedNumber
            });
            modified = true;
            return { ...phone, number: update.migratedNumber };
          }
          return phone;
        });
      }

      if (modified) {
        try {
          await Contacts.updateContactAsync(newContact);
          count++;
        } catch (err) {
          console.error('Failed to update contact', item.name, err);
        }
      }
    }

    // Save backup to AsyncStorage
    try {
      const existingStr = await AsyncStorage.getItem('@migration_backup');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      await AsyncStorage.setItem('@migration_backup', JSON.stringify([...existing, ...backupLog]));
    } catch (err) {
      console.error('Failed to save backup log', err);
    }

    setUpdateCount(count);
    setAppState('success');
  };

  const performRevert = async () => {
    try {
      const existingStr = await AsyncStorage.getItem('@migration_backup');
      if (!existingStr) {
        Alert.alert('No Backups', 'No migration backups found.');
        return;
      }

      const backups: any[] = JSON.parse(existingStr);
      if (backups.length === 0) {
        Alert.alert('No Backups', 'No migration backups found.');
        return;
      }

      setAppState('updating');
      let revertCount = 0;

      // Group backups by contact ID
      const byContact: Record<string, any[]> = {};
      backups.forEach(b => {
        if (!byContact[b.contactId]) byContact[b.contactId] = [];
        byContact[b.contactId].push(b);
      });

      for (const contactId of Object.keys(byContact)) {
        try {
          const contact = await Contacts.getContactByIdAsync(contactId);
          if (contact && contact.phoneNumbers) {
            let modified = false;
            contact.phoneNumbers = contact.phoneNumbers.map((phone: any) => {
              const b = byContact[contactId].find(x => x.phoneId === phone.id && x.newNumber === phone.number);
              if (b) {
                modified = true;
                return { ...phone, number: b.oldNumber };
              }
              return phone;
            });

            if (modified) {
              await Contacts.updateContactAsync(contact);
              revertCount++;
            }
          }
        } catch (err) {
          console.error('Error reverting contact', contactId, err);
        }
      }

      await AsyncStorage.removeItem('@migration_backup');
      Alert.alert('Revert Complete', `Successfully reverted ${revertCount} contacts.`);
      setAppState('welcome');

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to revert migrations.');
      setAppState('welcome');
    }
  };

  const renderWelcome = () => (
    <View className="flex-1 justify-center items-center p-6 bg-slate-50">
      <View className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm items-center">
        <Image 
          source={require('../../assets/images/icon.png')} 
          className="w-24 h-24 mb-6 rounded-2xl"
          resizeMode="contain"
        />
        <Text className="text-3xl font-bold text-center text-slate-800 mb-4">The Gambia 9-Digit Migration</Text>
        <Text className="text-slate-600 text-center mb-8 text-base">
          Update your phone contacts to the new 9-digit format mandated by PURA seamlessly and securely.
        </Text>
        <TouchableOpacity
          className="bg-blue-600 py-4 px-6 rounded-2xl active:bg-blue-700 mb-4"
          onPress={startScanning}
        >
          <Text className="text-white font-bold text-center text-lg">Scan Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-slate-200 py-4 px-6 rounded-2xl active:bg-slate-300"
          onPress={performRevert}
        >
          <Text className="text-slate-700 font-bold text-center text-lg">Undo Migration</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderScanning = () => (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-4 text-slate-600 font-medium">Scanning contacts...</Text>
    </View>
  );

  const renderReview = () => {
    const selectedCount = migratableContacts.filter(c => c.selected).length;

    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="p-4 border-b border-slate-200 bg-white">
          <Text className="text-xl font-bold text-slate-800">Review Updates</Text>
          <Text className="text-slate-500">{migratableContacts.length} contacts found needing updates.</Text>
        </View>
        <ScrollView className="flex-1 p-4">
          {migratableContacts.map((contact, index) => (
            <View key={contact.id} className="bg-white p-4 mb-3 rounded-2xl shadow-sm flex-row items-center">
              <View className="flex-1 pr-4">
                <Text className="font-bold text-slate-800 text-base">{contact.name}</Text>
                {contact.numbersToUpdate.map((num, i) => (
                  <View key={i} className="mt-1">
                    <Text className="text-slate-400 text-sm line-through">{num.originalNumber}</Text>
                    <Text className="text-green-600 font-medium text-sm">{num.migratedNumber}</Text>
                  </View>
                ))}
              </View>
              <Switch
                value={contact.selected}
                onValueChange={() => toggleContactSelection(index)}
                trackColor={{ false: "#cbd5e1", true: "#3b82f6" }}
              />
            </View>
          ))}
          <View className="h-20" />
        </ScrollView>
        <View className="p-4 bg-white border-t border-slate-200 absolute bottom-0 left-0 right-0">
          <TouchableOpacity
            className={`py-4 px-6 rounded-2xl ${selectedCount > 0 ? 'bg-blue-600 active:bg-blue-700' : 'bg-slate-300'}`}
            disabled={selectedCount === 0}
            onPress={performUpdate}
          >
            <Text className="text-white font-bold text-center text-lg">
              Update {selectedCount} Contacts
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const renderUpdating = () => (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-4 text-slate-600 font-medium">Updating your contacts...</Text>
    </View>
  );

  const renderSuccess = () => (
    <View className="flex-1 justify-center items-center p-6 bg-slate-50">
      <View className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm items-center">
        <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
          <Text className="text-green-600 text-3xl">✓</Text>
        </View>
        <Text className="text-2xl font-bold text-center text-slate-800 mb-2">Success!</Text>
        <Text className="text-slate-600 text-center mb-8">
          Successfully updated {updateCount} contacts to the new 9-digit format.
        </Text>
        <TouchableOpacity
          className="bg-slate-100 py-3 px-6 rounded-2xl w-full active:bg-slate-200"
          onPress={() => setAppState('welcome')}
        >
          <Text className="text-slate-700 font-semibold text-center">Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  switch (appState) {
    case 'welcome': return renderWelcome();
    case 'scanning': return renderScanning();
    case 'review': return renderReview();
    case 'updating': return renderUpdating();
    case 'success': return renderSuccess();
    default: return renderWelcome();
  }
}
