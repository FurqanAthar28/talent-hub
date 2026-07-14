import CompanyInformationSection from "./CompanyInformationSection";

type RecruiterEditProfileProps = {
  content: Record<string, string | undefined>;
  formData: {
    companyName: string;
    companyWebsite: string;
    companyLocation: string;
    hiringTitle: string;
  };
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
};

export default function RecruiterEditProfile({
  content,
  formData,
  handleChange,
}: RecruiterEditProfileProps) {
  return (
    <>
      <CompanyInformationSection
        content={content}
        formData={formData}
        handleChange={handleChange}
      />
    </>
  );
}