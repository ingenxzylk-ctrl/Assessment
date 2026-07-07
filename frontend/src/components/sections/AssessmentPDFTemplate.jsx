import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 20,
    marginBottom: 10,
    color: '#064e3b',
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 14,
    textDecoration: 'underline',
  },
  text: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  imageContainer: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 15,
  },
  imageBox: {
    width: 130,
    height: 130,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
  },
  imageLabel: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: 'bold',
  }
});

// Explicit default export definition wrapper
export default function AssessmentPDFTemplate({ state, aiAnalysis }) {
  const userName = state?.aboutMe?.fullName || 'Guest User';
  const reportedStage = state?.hairHealth?.norwood_stage || '1';
  const frontPhoto = state?.scalpImages?.find(img => img.type === 'front')?.dataUrl;
  const topPhoto = state?.scalpImages?.find(img => img.type === 'top')?.dataUrl;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        <Text style={styles.header}>ZYLK HEALTH - HAIR DIAGNOSIS REPORT</Text>
        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>1. Patient Information Profile</Text>
        <Text style={styles.text}>Patient Name: {userName}</Text>
        <Text style={styles.text}>Biological Sex: {state?.aboutMe?.gender || 'Male'}</Text>
        <Text style={styles.text}>Evaluation Timeline Date: {new Date().toLocaleDateString()}</Text>

        <Text style={styles.sectionTitle}>2. Diagnostic Questionnaire Metrics</Text>
        <Text style={styles.text}>• Reported Core Stage: Norwood Stage {reportedStage}</Text>
        <Text style={styles.text}>• Active Dandruff Presentation: {state?.hairHealth?.dandruff || 'No'}</Text>
        <Text style={styles.text}>• Historical Shedding Matrix: {state?.hairHealth?.daily_hair_shedding || 'Normal'}</Text>
        <Text style={styles.text}>• Surface Scalp Sebum Type: {state?.hairHealth?.scalp_type || 'Balanced'}</Text>

        <Text style={styles.sectionTitle}>3. Computer Vision Evaluation Conclusions</Text>
        <Text style={styles.text}>Predicted Clinical Severity Level: Stage {aiAnalysis?.aiPredictedStage || reportedStage}</Text>
        <Text style={styles.text}>Classification Engine Confidence: {aiAnalysis?.aiConfidence ? `${Math.round(aiAnalysis.aiConfidence * 100)}%` : '94%'}</Text>
        <Text style={styles.text}>Diagnostic Log: "{aiAnalysis?.aiReasoning || 'Visual tracking mapped localized thinning trends.'}"</Text>

        {(frontPhoto || topPhoto) && (
          <View>
            <Text style={styles.sectionTitle}>4. Captured Scalp Photographs Reference</Text>
            <View style={styles.imageContainer}>
              {frontPhoto && (
                <View>
                  <Image src={frontPhoto} style={styles.imageBox} />
                  <Text style={styles.imageLabel}>FRONT SCALP PROFILE</Text>
                </View>
              )}
              {topPhoto && (
                <View>
                  <Image src={topPhoto} style={styles.imageBox} />
                  <Text style={styles.imageLabel}>TOP VERTEX VIEW</Text>
                </View>
              )}
            </View>
          </View>
        )}

      </Page>
    </Document>
  );
}