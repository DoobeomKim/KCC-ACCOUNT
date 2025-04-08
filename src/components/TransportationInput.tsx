import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GermanNumberInput } from "@/components/ui/german-number-input";
import DatePicker from "@/components/DatePicker";
import CountrySelector from "@/components/CountrySelector";
import { Trash2 } from "lucide-react";
import { ExpenseFormTransportation } from "@/types/expense";

interface TransportationInputProps {
  transportation: ExpenseFormTransportation[];
  updateTransportation: (index: number, field: keyof ExpenseFormTransportation, value: any) => void;
  removeTransportation: (index: number) => void;
}

export const TransportationInput = ({ transportation, updateTransportation, removeTransportation }: TransportationInputProps) => {
  const t = useTranslations();
  
  return (
    <div>
      {transportation.map((item, index) => (
        <div key={index} className="mb-4 p-4 border rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t("expense.transportation.title")} #{index + 1}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTransportation(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>{t("expense.transportation.date.label")}</Label>
              <DatePicker
                date={item.date}
                setDate={(date) => updateTransportation(index, 'date', date)}
                placeholder={t("expense.transportation.date.placeholder")}
              />
            </div>
            <div>
              <Label>{t("expense.transportation.type.label")}</Label>
              <Select
                value={item.type}
                onValueChange={(value) => updateTransportation(index, 'type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("expense.transportation.type.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">{t("expense.transportation.type.flight")}</SelectItem>
                  <SelectItem value="train">{t("expense.transportation.type.train")}</SelectItem>
                  <SelectItem value="taxi">{t("expense.transportation.type.taxi")}</SelectItem>
                  <SelectItem value="fuel">{t("expense.transportation.type.fuel")}</SelectItem>
                  <SelectItem value="rental">{t("expense.transportation.type.rental")}</SelectItem>
                  <SelectItem value="mileage">{t("expense.transportation.type.mileage")}</SelectItem>
                  <SelectItem value="km_pauschale">{t("expense.transportation.type.km_pauschale")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(item.type === 'mileage' || item.type === 'km_pauschale') ? (
            <div className="form-group">
              <Label className="form-label">{t("expense.transportation.mileage.label")}</Label>
              <div className="form-input-with-unit">
                <GermanNumberInput
                  value={item.mileage || ''}
                  onChange={(value) => updateTransportation(index, 'mileage', String(value))}
                  placeholder={t("expense.transportation.mileage.placeholder")}
                />
                <span className="form-input-unit">km</span>
              </div>
            </div>
          ) : (
            <>
              {/* 결제자와 부가세를 한 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 결제자 */}
                <div className="form-group">
                  <Label className="form-label">{t("expense.paidBy.label")}</Label>
                  <Select
                    value={item.paidBy}
                    onValueChange={(value) => updateTransportation(index, 'paidBy', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("expense.paidBy.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">{t("expense.paidBy.company")}</SelectItem>
                      <SelectItem value="personal">{t("expense.paidBy.personal")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* 부가세 */}
                <div className="form-group">
                  <Label className="form-label">{t("expense.transportation.vat.label")}</Label>
                  <div className="form-input-with-unit">
                    <GermanNumberInput
                      value={item.vat}
                      onChange={(value) => updateTransportation(index, 'vat', String(value))}
                      placeholder={t("expense.transportation.vat.placeholder")}
                    />
                    <span className="form-input-unit">€</span>
                  </div>
                </div>
              </div>
              {/* 총액 */}
              <div className="form-group">
                <Label className="form-label">{t("expense.transportation.totalAmount.label")}</Label>
                <div className="form-input-with-unit">
                  <GermanNumberInput
                    value={item.totalAmount}
                    onChange={(value) => updateTransportation(index, 'totalAmount', String(value))}
                    placeholder={t("expense.transportation.totalAmount.placeholder")}
                  />
                  <span className="form-input-unit">€</span>
                </div>
              </div>
            </>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>{t("expense.transportation.country.label")}</Label>
              <CountrySelector
                value={item.country}
                onChange={(value) => updateTransportation(index, 'country', value)}
                placeholder={t("expense.transportation.country.placeholder")}
              />
            </div>
            <div>
              <Label>{t("expense.transportation.companyName.label")}</Label>
              <Input
                value={item.companyName}
                onChange={(e) => updateTransportation(index, 'companyName', e.target.value)}
                placeholder={t("expense.transportation.companyName.placeholder")}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 