import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '@/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  order: number;
}

const HomeCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselData, setCarouselData] = useState<CarouselItem[]>([]);

  useEffect(() => {
    loadCarouselData();
  }, []);

  const loadCarouselData = async () => {
    try {
      const carouselRef = collection(db, 'carousel');
      const q = query(carouselRef, orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const items: CarouselItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as CarouselItem);
      });
      setCarouselData(items);
    } catch (error) {
      console.error('Error loading carousel data:', error);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      (prevIndex + 1) % carouselData.length
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? carouselData.length - 1 : prevIndex - 1
    );
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [carouselData.length]);

  return (
    <View style={styles.container}>
      <View style={styles.carouselContainer}>
        <TouchableOpacity style={[styles.navButton, { left: 10 }]} onPress={prevSlide}>
          <MaterialIcons name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.slideContainer}>
          {carouselData.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.slide,
                {
                  opacity: index === currentIndex ? 1 : 0,
                  transform: [
                    {
                      scale: index === currentIndex ? 1 : 0.9,
                    },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)']}
                style={styles.gradient}
              />
              <View style={styles.contentContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.navButton, { right: 10 }]} onPress={nextSlide}>
          <MaterialIcons name="chevron-right" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.dotsContainer}>
          {carouselData.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              onPress={() => setCurrentIndex(index)}
            >
              <View style={[
                styles.dot, 
                index === currentIndex && styles.activeDot
              ]} />
            </TouchableOpacity>
          ))}
        </View>
        
      </View>
    </View>
  );
};

export default HomeCarousel;

const styles = StyleSheet.create({
  container: {
    height: 200,
    alignItems: 'center',
    backgroundColor: 'blue',
  },
  carouselContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0000',
  },
  slideContainer: {
    height: '100%',
    overflow: 'hidden',
  },
  slide: {
    width: '100%',
    height: 200,
    position: 'absolute',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -25 }],
    zIndex: 1,
    backgroundColor: 'transparent',
    borderRadius: 25,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // padding: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 25
  },
  description: {
    fontSize: 10,
    lineHeight: 20,
    color: '#fff',
    marginBottom: 24,
    marginLeft: 25
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.3 }],
  },
});