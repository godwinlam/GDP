import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Platform
} from "react-native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/providers/AuthProvider";
import CountryFlag from "react-native-country-flag";
import LottieView from "lottie-react-native";
import { countries, countriesList, Country } from "@/utils/countries";
import { MaterialIcons } from '@expo/vector-icons';
import OTCListingDetail from './OTCListingDetail';
import { useLanguage } from '@/hooks/useLanguage';

interface OTCListing {
  id: string;
  listingId?: string;
  sellerId: string;
  gdpAmount: number;
  sellingPrice: number;
  status: string;
  createdAt: any;
  animationFile: string;
  countryCode: string;
  sellerUsername: string;
}

export default function OTCListingsScreen() {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState<OTCListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredListings, setFilteredListings] = useState<OTCListing[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [filteredCountries, setFilteredCountries] = useState(countriesList);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const { t } = useLanguage();

  useEffect(() => {
    const listingsQuery = query(
      collection(db, "otcListings"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(listingsQuery, (snapshot) => {
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as OTCListing[];
      setListings(listingsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterListings(listings, searchQuery, selectedCountry?.code || null);
  }, [listings, searchQuery, selectedCountry]);

  useEffect(() => {
    const filtered = countriesList.filter((country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase())
    );
    setFilteredCountries(filtered);
  }, [countrySearch]);

  const filterListings = (
    listingsToFilter: OTCListing[],
    search: string,
    countryCode: string | null
  ) => {
    let filtered = listingsToFilter;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((listing) =>
        listing.sellerUsername.toLowerCase().includes(searchLower) ||
        countries[listing.countryCode]?.name.toLowerCase().includes(searchLower) ||
        listing.gdpAmount.toString().includes(searchLower)
      );
    }

    if (countryCode) {
      filtered = filtered.filter((listing) => listing.countryCode === countryCode);
    }

    setFilteredListings(filtered);
  };

  const handleBuyNow = (listingId: string) => {
    setSelectedListing(listingId);
    setShowDetailModal(true);
  };

  const handleCloseDetail = () => {
    setSelectedListing(null);
    setShowDetailModal(false);
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const renderListingItem = ({ item }: { item: OTCListing }) => {
    const isOwner = item.sellerId === currentUser?.uid;

    return (
      <View style={styles.listingCard}>
        <View style={styles.listingContent}>
          <View style={styles.leftContent}>
            <View style={styles.flagContainer}>
              <CountryFlag isoCode={item.countryCode} size={24} />
              <Text style={styles.countryName}>
                {countries[item.countryCode]?.name || item.countryCode}
              </Text>
            </View>
            <View style={styles.gdpContainer}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={
                    item.animationFile === 'star-1.json'
                      ? require('@/assets/animations/star-1.json') :
                      item.animationFile === '2-star.json'
                        ? require('@/assets/animations/2-star.json')
                        : item.animationFile === '3-star.json'
                          ? require('@/assets/animations/3-star.json')
                          : item.animationFile === '4-star.json'
                            ? require('@/assets/animations/4-star.json')
                            : item.animationFile === '5-star.json'
                              ? require('@/assets/animations/5-star.json')
                              : require('@/assets/animations/Crown.json')
                  }
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
              <Text style={styles.gdpAmount}>{item.gdpAmount.toLocaleString()} GDP</Text>
            </View>
            <Text style={styles.sellerName}>{t.seller}: {item.sellerUsername}</Text>
          </View>

          <View style={styles.rightContent}>
            <Text style={styles.price}>
              ${item.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {!isOwner && (
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => handleBuyNow(item.listingId || item.id)}
              >
                <MaterialIcons name="shopping-cart" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buyButtonText}>{t.buyNow}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderCountryFilter = () => (
    <View style={styles.countryFilterContainer}>
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={24} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder={`${t.search} ${t.country}...`}
          value={countrySearch}
          onChangeText={setCountrySearch}
          placeholderTextColor="#999"
        />
        {countrySearch ? (
          <TouchableOpacity onPress={() => setCountrySearch("")}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.countryFilter}
        contentContainerStyle={styles.countryFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.countryFilterItem,
            !selectedCountry && styles.selectedCountryFilter
          ]}
          onPress={() => setSelectedCountry(null)}
        >
          <Text style={[
            styles.countryFilterText,
            !selectedCountry && styles.selectedCountryFilterText
          ]}>{t.allCountries}</Text>
        </TouchableOpacity>
        {filteredCountries.map((country) => (
          <TouchableOpacity
            key={country.code}
            style={[
              styles.countryFilterItem,
              selectedCountry?.code === country.code && styles.selectedCountryFilter
            ]}
            onPress={() => setSelectedCountry(country)}
          >
            <CountryFlag isoCode={country.code} size={20} />
            <Text style={[
              styles.countryFilterText,
              selectedCountry?.code === country.code && styles.selectedCountryFilterText
            ]}>{country.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderCountryFilter()}
      <FlatList
        data={filteredListings}
        renderItem={renderListingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="list-alt" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery || selectedCountry
                ? t.noListingsFound
                : t.noListingsAvailable}
            </Text>
          </View>
        }
      />
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDetail}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedListing && (
              <OTCListingDetail
                listingId={selectedListing}
                onClose={handleCloseDetail}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  countryFilterContainer: {
    marginTop: Platform.OS === 'android' ? 30 : 0,
    backgroundColor: "#fff",
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  countryFilter: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  countryFilterContent: {
    paddingHorizontal: 16,
  },
  countryFilterItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  selectedCountryFilter: {
    backgroundColor: "#1a237e",
  },
  countryFilterText: {
    marginLeft: 8,
    color: "#666",
    fontSize: 14,
  },
  selectedCountryFilterText: {
    color: "#fff",
  },
  listingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  listingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContent: {
    flex: 1,
    marginRight: 16,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  countryName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  gdpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lottieContainer: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
  gdpAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  sellerName: {
    fontSize: 13,
    color: '#666',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  buttonIcon: {
    marginRight: 4,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginHorizontal: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 1,
      },
      default: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
});
